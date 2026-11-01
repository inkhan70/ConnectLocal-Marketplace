/** @jest-environment node */
import { bootstrapProfile, sanitizeHints, BOOTSTRAP_DOC } from '@/lib/server/admin-bootstrap';

/**
 * In-memory stand-in for Firestore that reproduces the property the bootstrap relies on: a transaction only
 * commits if every document/query it READ is unchanged since it read them, otherwise it is retried.
 * Reads yield to the event loop so concurrent transactions genuinely interleave.
 * NOTE: this validates our logic under contention; it is not a substitute for the Firestore emulator.
 */
class FakeDb {
  docs = new Map<string, any>();
  versions = new Map<string, number>();
  usersVersion = 0;
  retries = 0;

  private bump(path: string) {
    this.versions.set(path, (this.versions.get(path) || 0) + 1);
    if (path.startsWith('users/')) this.usersVersion++;
  }
  seed(path: string, data: any) { this.docs.set(path, { ...data }); this.bump(path); }

  collection(name: string) {
    const db = this;
    const ref = (id: string) => ({ path: `${name}/${id}`, id, __ref: true });
    return {
      doc: ref,
      where(field: string, _op: string, value: any) {
        return { __query: true, name, field, value, limit() { return this; } };
      },
    } as any;
  }

  async runTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 50; attempt++) {
      const reads: Array<() => number> = [];
      const expect: number[] = [];
      const writes: Array<() => void> = [];
      const tx = {
        get: async (target: any) => {
          await new Promise((r) => setImmediate(r));
          if (target.__query) {
            const matches = [...this.docs.entries()].filter(([p, d]) => p.startsWith(`${target.name}/`) && d[target.field] === target.value);
            reads.push(() => this.usersVersion); expect.push(this.usersVersion);
            return { empty: matches.length === 0, docs: matches };
          }
          reads.push(() => this.versions.get(target.path) || 0); expect.push(this.versions.get(target.path) || 0);
          const data = this.docs.get(target.path);
          return { exists: data !== undefined, data: () => (data ? { ...data } : undefined) };
        },
        set: (ref: any, data: any, opts?: any) => writes.push(() => {
          const prev = this.docs.get(ref.path);
          this.docs.set(ref.path, opts?.merge && prev ? { ...prev, ...data } : { ...data });
          this.bump(ref.path);
        }),
      };
      const result = await fn(tx);
      if (reads.every((r, i) => r() === expect[i])) { writes.forEach((w) => w()); return result; }
      this.retries++;
    }
    throw new Error('too much contention');
  }
}

class FakeAuth {
  claims = new Map<string, any>();
  async getUser(uid: string) { return { uid, customClaims: this.claims.get(uid) }; }
  async setCustomUserClaims(uid: string, c: any) { this.claims.set(uid, c); }
}

const verified = (uid: string) => ({ uid, email: `${uid}@x.com`, emailVerified: true });
const run = (db: FakeDb, auth: FakeAuth, caller: any, hints = {}) => bootstrapProfile(db as any, auth as any, caller, hints);
const adminCount = (db: FakeDb) => [...db.docs.entries()].filter(([p, d]) => p.startsWith('users/') && d.isAdmin === true).length;

describe('first-admin bootstrap', () => {
  test('first verified user becomes admin; profile created; claims preserved', async () => {
    const db = new FakeDb(), auth = new FakeAuth();
    auth.claims.set('a', { tenant: 't1' });
    const r = await run(db, auth, verified('a'), { role: 'company', businessName: 'Acme' });
    expect(r).toMatchObject({ isAdmin: true, becameAdmin: true, profileCreated: true, needsRoleSelection: false });
    expect(db.docs.get('users/a').isAdmin).toBe(true);
    expect(db.docs.get('users/a').businessName).toBe('Acme');
    expect(auth.claims.get('a')).toEqual({ tenant: 't1', isAdmin: true, role: 'admin' });
    expect(db.docs.get(`${BOOTSTRAP_DOC.collection}/${BOOTSTRAP_DOC.id}`)).toMatchObject({ initialized: true, firstAdminUid: 'a' });
  });

  test('simultaneous first-time signups: exactly one admin', async () => {
    const db = new FakeDb(), auth = new FakeAuth();
    const ids = Array.from({ length: 25 }, (_, i) => `u${i}`);
    const results = await Promise.all(ids.map((id) => run(db, auth, verified(id))));
    expect(results.filter((r) => r.becameAdmin)).toHaveLength(1);
    expect(adminCount(db)).toBe(1);
    expect([...auth.claims.values()].filter((c) => c.isAdmin).length).toBe(1);
    expect(db.retries).toBeGreaterThan(0); // contention really happened
  });

  test('existing admin: nobody is auto-promoted, system marked initialised', async () => {
    const db = new FakeDb(), auth = new FakeAuth();
    db.seed('users/old', { isAdmin: true, role: 'buyer' });
    const r = await run(db, auth, verified('new'));
    expect(r.isAdmin).toBe(false);
    expect(adminCount(db)).toBe(1);
    expect(db.docs.get('config/bootstrap')).toMatchObject({ initialized: true, reason: 'admin_exists' });
  });

  test('once initialised, later users never become admin (even if no admin remains)', async () => {
    const db = new FakeDb(), auth = new FakeAuth();
    await run(db, auth, verified('first'));
    db.docs.get('users/first').isAdmin = false; db.usersVersion++; // admin removed later
    const r = await run(db, auth, verified('second'));
    expect(r.isAdmin).toBe(false);
    expect(adminCount(db)).toBe(0);
  });

  test('unverified email is deferred, not initialised; verified user can win later', async () => {
    const db = new FakeDb(), auth = new FakeAuth();
    const r1 = await run(db, auth, { uid: 'p', email: 'p@x.com', emailVerified: false });
    expect(r1).toMatchObject({ isAdmin: false, deferredReason: 'email_not_verified', profileCreated: true });
    expect(db.docs.has('config/bootstrap')).toBe(false);
    const r2 = await run(db, auth, verified('p'));
    expect(r2).toMatchObject({ isAdmin: true, becameAdmin: true, profileCreated: false });
  });

  test('existing user/profile data is preserved on promotion and other users untouched', async () => {
    const db = new FakeDb(), auth = new FakeAuth();
    db.seed('users/e', { role: 'shopkeeper', businessName: 'Shop', ghostCoins: 42, roleSelectionCompleted: true });
    db.seed('users/other', { role: 'buyer', balance: 5 });
    await run(db, auth, verified('e'));
    expect(db.docs.get('users/e')).toMatchObject({ role: 'shopkeeper', businessName: 'Shop', ghostCoins: 42, isAdmin: true });
    expect(db.docs.get('users/other')).toEqual({ role: 'buyer', balance: 5 });
  });

  test('missing profile for a non-first user is created as non-admin needing role selection', async () => {
    const db = new FakeDb(), auth = new FakeAuth();
    await run(db, auth, verified('first'));
    const r = await run(db, auth, verified('late'));
    expect(r).toMatchObject({ isAdmin: false, profileCreated: true, needsRoleSelection: true });
    expect(db.docs.get('users/late').isAdmin).toBe(false);
  });

  test('idempotent for the admin and repairs a missing claim', async () => {
    const db = new FakeDb(), auth = new FakeAuth();
    await run(db, auth, verified('a'));
    auth.claims.set('a', { keep: true }); // simulate claim write that failed earlier
    const r = await run(db, auth, verified('a'));
    expect(r).toMatchObject({ isAdmin: true, becameAdmin: false });
    expect(auth.claims.get('a')).toEqual({ keep: true, isAdmin: true, role: 'admin' });
  });

  test('client-supplied hints can never carry privileged fields', () => {
    const hints: any = sanitizeHints({ isAdmin: true, permissions: ['x'], balance: 9, role: 'admin', city: 'Karachi', fullName: 'A' });
    expect(hints).toEqual({ city: 'Karachi', fullName: 'A' });
    expect(sanitizeHints({ role: 'company' }).role).toBe('company');
  });

  test('legacy profile with a role is NOT sent back through role selection', async () => {
    const db = new FakeDb(), auth = new FakeAuth();
    await run(db, auth, verified('first'));
    db.seed('users/legacy', { role: 'company', businessName: 'Old Co' }); // no roleSelectionCompleted flag
    const r = await run(db, auth, verified('legacy'));
    expect(r).toMatchObject({ isAdmin: false, profileCreated: false, needsRoleSelection: false });
    expect(db.docs.get('users/legacy').role).toBe('company');
  });

  test('profile explicitly flagged for onboarding still needs role selection', async () => {
    const db = new FakeDb(), auth = new FakeAuth();
    await run(db, auth, verified('first'));
    db.seed('users/new', { role: 'buyer', needsRoleSelection: true });
    const r = await run(db, auth, verified('new'));
    expect(r.needsRoleSelection).toBe(true);
  });

  test('admin by custom claim only: profile is healed and never sent to role selection', async () => {
    const db = new FakeDb(), auth = new FakeAuth();
    await run(db, auth, verified('first'));
    db.seed('users/c', { role: 'buyer', needsRoleSelection: true });
    const r = await run(db, auth, { ...verified('c'), claimIsAdmin: true });
    expect(r).toMatchObject({ isAdmin: true, becameAdmin: false, needsRoleSelection: false });
    expect(db.docs.get('users/c')).toMatchObject({ isAdmin: true, needsRoleSelection: false });
  });

  test('a failing claim write does not fail sign-in (profile flag still grants admin)', async () => {
    const db = new FakeDb(), auth = new FakeAuth();
    auth.setCustomUserClaims = async () => { throw Object.assign(new Error('denied'), { code: 'auth/insufficient-permission' }); };
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const r = await run(db, auth, verified('a'));
    spy.mockRestore();
    expect(r).toMatchObject({ isAdmin: true, claimsSynced: false });
    expect(db.docs.get('users/a').isAdmin).toBe(true);
  });

  describe('sign-up choices (role + business type)', () => {
    const seed = async () => { const db = new FakeDb(), auth = new FakeAuth(); await run(db, auth, verified('first')); return { db, auth }; };

    test('dentist chosen at sign-up skips role selection and gets the matching dashboard', async () => {
      const { db, auth } = await seed();
      const r = await run(db, auth, verified('dr'), {
        role: 'services', roleSelected: true, businessName: 'Dr Gopal', subcategoryId: 'health_dentist',
        category: 'whatever the browser sent', latitude: 24.86, longitude: 67.01,
      });
      expect(r).toMatchObject({ profileCreated: true, needsRoleSelection: false, isAdmin: false });
      expect(db.docs.get('users/dr')).toMatchObject({
        role: 'services', category: 'medical', subcategoryId: 'health_dentist',
        subcategoryName: 'Dentist / Dental Surgeon', dashboardType: 'services',
        latitude: 24.86, longitude: 67.01, roleSelectionCompleted: true, needsRoleSelection: false,
      });
    });

    test('manual sign-up as a buyer goes straight to the buyer dashboard (no role selection)', async () => {
      const { db, auth } = await seed();
      const r = await run(db, auth, verified('buyer1'), { role: 'buyer', roleSelected: true, fullName: 'Ayesha Khan', city: 'Karachi' });
      expect(r).toMatchObject({ profileCreated: true, needsRoleSelection: false, isAdmin: false });
      expect(db.docs.get('users/buyer1')).toMatchObject({ role: 'buyer', dashboardType: 'buyer', needsRoleSelection: false, roleSelectionCompleted: true });
    });

    test('a buyer who picks an interest type (Collector) stays a buyer with the buyer dashboard', async () => {
      const { db, auth } = await seed();
      const collector = (id: string, role: string) => ({ categoryKey: 'antiques', categoryId: 'cat_a', option: { id, name: 'Collector', role, dashboardType: role === 'buyer' ? 'buyer' : 'shopkeeper' } });
      const asBuyer = await bootstrapProfile(db as any, auth as any, verified('c1'), { role: 'buyer', roleSelected: true, fullName: 'Collector One', subcategoryId: 'cat_a_sub', category: 'antiques' }, collector as any);
      expect(asBuyer.needsRoleSelection).toBe(false);
      expect(db.docs.get('users/c1')).toMatchObject({ role: 'buyer', dashboardType: 'buyer', subcategoryName: 'Collector', category: 'antiques' });
      // Even if the browser claimed a business role, a Collector type is always a buyer on the server.
      await bootstrapProfile(db as any, auth as any, verified('c2'), { role: 'shopkeeper', roleSelected: true, businessName: 'x', subcategoryId: 'cat_a_sub', category: 'antiques' }, collector as any);
      expect(db.docs.get('users/c2')).toMatchObject({ role: 'buyer', dashboardType: 'buyer' });
    });

    test('a clinic gets the health dashboard', async () => {
      const { db, auth } = await seed();
      await run(db, auth, verified('c'), { role: 'company', roleSelected: true, businessName: 'Smile Clinic', subcategoryId: 'health_clinic' });
      expect(db.docs.get('users/c').dashboardType).toBe('health');
    });

    test('business role without a valid type still has to finish onboarding', async () => {
      const { db, auth } = await seed();
      const r = await run(db, auth, verified('x'), { role: 'shopkeeper', roleSelected: true, businessName: 'Shop', subcategoryId: 'not-a-real-type' });
      expect(r.needsRoleSelection).toBe(true);
      expect(db.docs.get('users/x').subcategoryId).toBe('');
    });

    test('buyers who chose at sign-up go straight to their dashboard; Google default hints do not skip onboarding', async () => {
      const { db, auth } = await seed();
      const b = await run(db, auth, verified('b'), { role: 'buyer', roleSelected: true, fullName: 'Buyer One' });
      expect(b.needsRoleSelection).toBe(false);
      const g = await run(db, auth, verified('g'), { role: 'buyer', fullName: 'Google user' });
      expect(g.needsRoleSelection).toBe(true);
    });

    test('WhatsApp number typed at sign-up is validated and stored as +E.164; junk is dropped', async () => {
      const { db, auth } = await seed();
      await run(db, auth, verified('w'), { role: 'shopkeeper', roleSelected: true, businessName: 'Shop', subcategoryId: 'health_pharmacy', contactWhatsapp: '+92 300-1234567' });
      expect(db.docs.get('users/w').contactWhatsapp).toBe('+923001234567');
      await run(db, auth, verified('w2'), { role: 'buyer', contactWhatsapp: 'not a number' });
      expect(db.docs.get('users/w2').contactWhatsapp).toBeUndefined();
    });

    test('client cannot smuggle privileges through hints', async () => {
      const { db, auth } = await seed();
      const { sanitizeHints } = await import('@/lib/server/admin-bootstrap');
      const hints = sanitizeHints({ role: 'admin', isAdmin: true, roleSelected: true, latitude: 999, longitude: 10 });
      expect(hints.role).toBeUndefined();
      expect((hints as any).isAdmin).toBeUndefined();
      expect(hints.latitude).toBeUndefined();
    });
  });
});
