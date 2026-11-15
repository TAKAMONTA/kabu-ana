import type { Metadata } from "next";

const TITLE = "マーケット・シグナル";
const DESCRIPTION =
  "原油・金利などの主要指標、エネルギー・地政学ニュース、地震、投資環境のリスクと AI による市場ブリーフを 30 秒で確認できます。";

// page.tsx はクライアントコンポーネントで metadata を書けないため、レイアウトで指定する
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/signals" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/signals",
  },
  twitter: {
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function SignalsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
