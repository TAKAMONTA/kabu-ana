import Image from "next/image";

export function SponsoredAds() {
  return (
    <aside
      aria-label="スポンサー広告"
      className="mt-12 rounded-md border border-border bg-muted/20 p-4 sm:p-5"
    >
      <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        スポンサー
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex justify-center rounded-md border border-border/70 bg-background p-3">
          <a
            href="https://px.a8.net/svt/ejp?a8mat=45FV1Z+56CP4I+1WP2+6G4HD"
            rel="nofollow sponsored noopener"
            target="_blank"
          >
            <Image
              width={250}
              height={250}
              alt="スポンサー広告 1"
              src="https://www24.a8.net/svt/bgt?aid=251002871313&wid=001&eno=01&mid=s00000008903001083000&mc=1"
              className="block max-w-full"
              unoptimized
            />
          </a>
          <Image
            width={1}
            height={1}
            src="https://www17.a8.net/0.gif?a8mat=45FV1Z+56CP4I+1WP2+6G4HD"
            alt=""
            aria-hidden="true"
            unoptimized
          />
        </div>

        <div className="flex justify-center rounded-md border border-border/70 bg-background p-3">
          <a
            href="https://px.a8.net/svt/ejp?a8mat=45GF9C+BAN2YA+3KHK+BXYE9"
            rel="nofollow sponsored noopener"
            target="_blank"
          >
            <Image
              width={300}
              height={250}
              alt="スポンサー広告 2"
              src="https://www25.a8.net/svt/bgt?aid=251029056683&wid=001&eno=01&mid=s00000016652002006000&mc=1"
              className="block max-w-full"
              unoptimized
            />
          </a>
          <Image
            width={1}
            height={1}
            src="https://www10.a8.net/0.gif?a8mat=45GF9C+BAN2YA+3KHK+BXYE9"
            alt=""
            aria-hidden="true"
            unoptimized
          />
        </div>
      </div>
    </aside>
  );
}
