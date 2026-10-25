/** @jest-environment node */
import { formatPhone, getSellerContact, normalizePhone, smsUrl, telUrl, whatsappUrl } from '@/lib/contact';
import { toPublicBusiness } from '@/lib/server/public-profile';

describe('normalizePhone', () => {
  test.each([
    ['+92 300 1234567', undefined, '923001234567'],
    ['+92-300-1234567', undefined, '923001234567'],
    ['0092 300 1234567', undefined, '923001234567'],
    ['0300 1234567', 'PK', '923001234567'],
    ['0300-1234567', 'pk', '923001234567'],
    ['3001234567', 'PK', '923001234567'],
    ['923001234567', 'PK', '923001234567'],
    ['(555) 123-4567', 'US', '15551234567'],
    ['07911 123456', 'GB', '447911123456'],
  ])('%s (%s) -> %s', (input, country, digits) => {
    const r = normalizePhone(input, country);
    expect(r).toMatchObject({ ok: true, digits, e164: `+${digits}` });
  });

  test('local numbers without a country are rejected with a helpful message', () => {
    expect(normalizePhone('0300 1234567')).toMatchObject({ ok: false });
    expect(normalizePhone('0300 1234567').error).toMatch(/country code/i);
  });

  test('junk is rejected', () => {
    for (const bad of ['', '   ', 'abc', '12', '+0', '+1234567890123456789', 'call me maybe', '300<script>']) {
      expect(normalizePhone(bad, 'PK').ok).toBe(false);
    }
  });
});

describe('links', () => {
  test('WhatsApp link carries the exact number and an encoded message', () => {
    expect(whatsappUrl('923001234567', 'Hi & hello? 100%')).toBe('https://wa.me/923001234567?text=Hi%20%26%20hello%3F%20100%25');
    expect(whatsappUrl('923001234567')).toBe('https://wa.me/923001234567');
  });
  test('tel and sms links', () => {
    expect(telUrl('923001234567')).toBe('tel:+923001234567');
    expect(smsUrl('923001234567', 'a b')).toBe('sms:+923001234567?body=a%20b');
  });
  test('formatPhone groups by country code', () => {
    expect(formatPhone('+923001234567')).toBe('+92 300 1234567');
  });
});

describe('getSellerContact', () => {
  test('call number falls back to the WhatsApp number', () => {
    expect(getSellerContact({ contactWhatsapp: '+923001234567' })).toEqual({ whatsapp: '923001234567', phone: '923001234567' });
  });
  test('separate call number is used for calls only', () => {
    expect(getSellerContact({ contactWhatsapp: '+923001234567', contactPhone: '+922134567890' })).toEqual({ whatsapp: '923001234567', phone: '922134567890' });
  });
  test('invalid or missing numbers produce no links', () => {
    expect(getSellerContact({ contactWhatsapp: 'nonsense' })).toEqual({ whatsapp: undefined, phone: undefined });
    expect(getSellerContact(null)).toEqual({ whatsapp: undefined, phone: undefined });
  });
});

describe('public profile exposes only validated contact numbers', () => {
  test('valid numbers are published in +E.164 form; invalid ones and private fields never are', () => {
    const out: any = toPublicBusiness('u1', { role: 'shopkeeper', countryCode: 'PK', contactWhatsapp: '0300 1234567', contactPhone: 'garbage', email: 'a@b.c', phone: '111' });
    expect(out.contactWhatsapp).toBe('+923001234567');
    expect(out).not.toHaveProperty('contactPhone');
    expect(out).not.toHaveProperty('phone');
    expect(out).not.toHaveProperty('email');
  });
});
