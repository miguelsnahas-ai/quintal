import type { Metadata } from "next";
import { Gabarito, Hanken_Grotesk, Caveat, Caveat_Brush, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Design system Quintal: Gabarito (títulos, Gabarito 600 — ver globals.css)
// + Hanken Grotesk (texto corrido) + Caveat (notas manuscritas, uso
// pontual) + Caveat Brush (só o Wordmark — "stand-in" do design system
// até a marca ser desenhada por um designer) + JetBrains Mono
// (eyebrows/meta, já usado antes desta troca). Self-hosted via
// next/font — mesmo resultado visual do
// `@import url(fonts.googleapis.com/...)` do design system, sem depender
// de rede em runtime.
const gabarito = Gabarito({
  variable: "--font-gabarito",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-hanken-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const caveatBrush = Caveat_Brush({
  variable: "--font-caveat-brush",
  subsets: ["latin"],
  weight: "400",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Quintal",
  description: "Ferramenta interna de operação do Quintal",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${gabarito.variable} ${hankenGrotesk.variable} ${caveat.variable} ${caveatBrush.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
