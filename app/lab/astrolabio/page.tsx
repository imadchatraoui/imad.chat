import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import AstrolabeLab from "@/components/astrolabe/AstrolabeLab";

export const metadata: Metadata = {
  title: "Laboratorio dell'astrolabio",
  description: "Banco di prova dell'astrolabio 3D di imad's world.",
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  themeColor: "#070a14",
};

export default function Page() {
  return (
    <div className={GeistMono.variable}>
      <AstrolabeLab />
    </div>
  );
}
