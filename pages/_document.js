import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* This is the fix for the app rendering as a tiny zoomed-out
            desktop page on phones - without it, mobile browsers assume a
            ~980px-wide virtual viewport and scale everything down to fit,
            which is what "not mobile friendly at all" actually was. */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <meta name="theme-color" content="#0d0716" />

        {/* PWA - lets "Add to Home Screen" produce a real app icon and
            full-screen launch on both Android and iOS, no app store or
            APK/IPA needed. */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Baouss Pro" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
