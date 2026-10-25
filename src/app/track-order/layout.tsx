import type { Metadata } from 'next';

// Order pages hold a private access key in their URL: never index or cache them.
export const metadata: Metadata = {
  title: 'Track your order',
  robots: { index: false, follow: false },
};

export default function TrackOrderLayout({ children }: { children: React.ReactNode }) {
  return children;
}
