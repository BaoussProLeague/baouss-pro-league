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
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
