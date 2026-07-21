import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { readFile } from "node:fs/promises";
import { Container } from "~/components/Container";
import { SectionHeading } from "~/components/SectionHeading";

// ── Types ──────────────────────────────────────────────────────────────

interface FacebookBio {
  shortDescription: string;
  about: string;
}

interface InstagramBio {
  bio: string;
}

interface LinkedInBio {
  tagline: string;
  about: string;
}

interface Caption {
  title: string;
  caption: string;
  hashtags: string;
}

interface FirstPost {
  copy: string;
}

interface BioData {
  facebookBio: FacebookBio;
  instagramBio: InstagramBio;
  linkedinBio: LinkedInBio;
  igCaptions: Caption[];
  firstFBPost: FirstPost;
  firstLinkedInPost: FirstPost;
}

interface ImageAsset {
  filename: string;
  label: string;
}

// ── Image manifest ─────────────────────────────────────────────────────

const IMAGES: ImageAsset[] = [
  { filename: "profile-pic.webp", label: "Profile Picture" },
  { filename: "fb-cover.webp", label: "Facebook Cover" },
  { filename: "li-banner.webp", label: "LinkedIn Banner" },
  { filename: "ig-post-1.webp", label: "Instagram Post 1 — \"MetroReach Media is live.\"" },
  { filename: "ig-post-2.webp", label: "Instagram Post 2 — \"Organic + Paid. Seven platforms. One team.\"" },
  { filename: "ig-post-3.webp", label: "Instagram Post 3 — \"340+ leads/month. 3.4x ROAS.\"" },
];

// ── Server function ────────────────────────────────────────────────────

const getBioData = createServerFn({ method: "GET" }).handler(async (): Promise<BioData> => {
  const raw = await readFile("/home/team/shared/social/bios-and-captions.md", "utf8");

  // ── helpers ──
  const section = (label: string): string => {
    const idx = raw.indexOf(label);
    if (idx === -1) return "";
    return raw.slice(idx + label.length);
  };

  const between = (text: string, startMarker: string, endMarker: string): string => {
    const s = text.indexOf(startMarker);
    if (s === -1) return "";
    const body = text.slice(s + startMarker.length);
    const e = body.indexOf(endMarker);
    return e === -1 ? body.trim() : body.slice(0, e).trim();
  };

  const blockquote = (text: string): string => {
    // Extract lines starting with "> " and join them
    return text
      .split("\n")
      .filter((l) => l.startsWith("> "))
      .map((l) => l.slice(2))
      .join("\n")
      .trim();
  };

  const codeBlock = (text: string): string => {
    const m = text.match(/```\n([\s\S]*?)```/);
    return m ? m[1].trim() : "";
  };

  // ── Extract sections ──

  // Facebook bio
  const fbSection = between(raw, "### Facebook Page Bio", "### Instagram Bio");
  const fbShort = blockquote(between(fbSection, "**Short Description**", "**About Section**"));
  const fbAboutBlock = between(fbSection, "**About Section**", "**Category:**");
  const fbAbout = blockquote(fbAboutBlock);

  // Instagram bio
  const igSection = between(raw, "### Instagram Bio", "### LinkedIn Company Page");
  const igBio = codeBlock(between(igSection, "**Bio**", "**Link in Bio"));

  // LinkedIn bio
  const liSection = section("### LinkedIn Company Page");
  const liTagline = blockquote(between(liSection, "**Tagline**", "**About Section**"));
  const liAboutBlock = between(liSection, "**About Section**", "## 2.");
  const liAbout = blockquote(liAboutBlock);

  // IG captions
  const captionsSection = between(raw, "## 2. FIRST 3 INSTAGRAM CAPTIONS", "## 3. FIRST FACEBOOK POST");
  const igCaptions: Caption[] = [];

  for (let i = 1; i <= 3; i++) {
    const postSection = between(captionsSection, `### Post ${i}:`, i < 3 ? `### Post ${i + 1}:` : "## 3.");
    const title = postSection.split("\n")[0].replace(/^"|"$/g, "").trim();
    const capBlock = between(postSection, "**Caption:**", "**Hashtags:**");
    const caption = blockquote(capBlock);
    const hashBlock = between(postSection, "**Hashtags:**", "**CTA:**");
    const hashtags = codeBlock(hashBlock);
    igCaptions.push({ title, caption, hashtags });
  }

  // First Facebook post
  const fbPostSection = between(raw, "## 3. FIRST FACEBOOK POST", "## 4. FIRST LINKEDIN POST");
  const fbPostCopy = blockquote(between(fbPostSection, "**Post Copy:**", "**CTA:**"));

  // First LinkedIn post
  const liPostSection = section("## 4. FIRST LINKEDIN POST");
  const liPostCopy = blockquote(between(liPostSection, "**Post Copy:**", "## APPENDIX"));

  return {
    facebookBio: {
      shortDescription: fbShort,
      about: fbAbout,
    },
    instagramBio: { bio: igBio },
    linkedinBio: {
      tagline: liTagline,
      about: liAbout,
    },
    igCaptions,
    firstFBPost: { copy: fbPostCopy },
    firstLinkedInPost: { copy: liPostCopy },
  };
});

// ── Route ──────────────────────────────────────────────────────────────

export const Route = createFileRoute("/social-kit")({
  loader: () => getBioData(),
  component: SocialKit,
});

// ── Sub-components ─────────────────────────────────────────────────────

function CopyBlock({ label, children }: { label: string; children: string }) {
  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-brand-accent uppercase tracking-wider mb-2">
        {label}
      </h4>
      <pre className="whitespace-pre-wrap text-sm text-text-secondary bg-bg-root rounded-xl p-5 border border-border-subtle font-body leading-relaxed">
        {children}
      </pre>
    </div>
  );
}

function ImageCard({ image }: { image: ImageAsset }) {
  const url = `/social/${image.filename}`;
  return (
    <div className="rounded-2xl bg-bg-surface-raised border border-border-subtle overflow-hidden card-hover">
      <div className="aspect-[4/3] bg-bg-root flex items-center justify-center p-4">
        <img
          src={url}
          alt={image.label}
          className="max-w-full max-h-full object-contain rounded-lg"
          loading="lazy"
        />
      </div>
      <div className="p-4 flex flex-col gap-2">
        <p className="text-sm font-medium text-text-primary">{image.label}</p>
        <a
          href={url}
          download
          className="inline-flex items-center gap-1.5 text-sm text-brand-primary hover:text-brand-primary-glow transition-colors font-medium"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download {image.filename}
        </a>
      </div>
    </div>
  );
}

function SocialKit() {
  const bio = Route.useLoaderData();

  return (
    <main className="py-24 bg-bg-surface min-h-dvh">
      <Container>
        <SectionHeading
          badge="Resources"
          headline="Social Media Rebrand Kit"
          description="Everything you need to roll out the MetroReach Media brand across your social channels. Download images and copy-paste bios, captions, and launch posts."
        />

        {/* ── IMAGE ASSETS ──────────────────────────────── */}
        <section className="mb-20">
          <h3 className="text-2xl font-bold font-heading text-text-primary mb-8">
            Image Assets
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {IMAGES.map((img) => (
              <ImageCard key={img.filename} image={img} />
            ))}
          </div>
        </section>

        {/* ── PLATFORM BIOS ─────────────────────────────── */}
        <section className="mb-20">
          <h3 className="text-2xl font-bold font-heading text-text-primary mb-8">
            Platform Bios
          </h3>

          <div className="space-y-10 max-w-3xl">
            {/* Facebook */}
            <div className="rounded-2xl bg-bg-surface-raised border border-border-subtle p-6">
              <h4 className="text-lg font-semibold font-heading text-text-primary mb-4">
                Facebook Page
              </h4>
              <CopyBlock label="Short Description (255 char limit)">
                {bio.facebookBio.shortDescription}
              </CopyBlock>
              <CopyBlock label="About Section">
                {bio.facebookBio.about}
              </CopyBlock>
            </div>

            {/* Instagram */}
            <div className="rounded-2xl bg-bg-surface-raised border border-border-subtle p-6">
              <h4 className="text-lg font-semibold font-heading text-text-primary mb-4">
                Instagram
              </h4>
              <CopyBlock label="Bio (150 char limit)">
                {bio.instagramBio.bio}
              </CopyBlock>
            </div>

            {/* LinkedIn */}
            <div className="rounded-2xl bg-bg-surface-raised border border-border-subtle p-6">
              <h4 className="text-lg font-semibold font-heading text-text-primary mb-4">
                LinkedIn Company Page
              </h4>
              <CopyBlock label="Tagline (120 char limit)">
                {bio.linkedinBio.tagline}
              </CopyBlock>
              <CopyBlock label="About Section">
                {bio.linkedinBio.about}
              </CopyBlock>
            </div>
          </div>
        </section>

        {/* ── INSTAGRAM CAPTIONS ────────────────────────── */}
        <section className="mb-20">
          <h3 className="text-2xl font-bold font-heading text-text-primary mb-8">
            First 3 Instagram Captions
          </h3>

          <div className="space-y-8 max-w-3xl">
            {bio.igCaptions.map((cap, i) => (
              <div
                key={i}
                className="rounded-2xl bg-bg-surface-raised border border-border-subtle p-6"
              >
                <h4 className="text-lg font-semibold font-heading text-text-primary mb-1">
                  Post {i + 1}: {cap.title}
                </h4>
                <p className="text-sm text-text-muted mb-4">
                  Image: ig-post-{i + 1}.webp
                </p>
                <CopyBlock label="Caption">
                  {cap.caption}
                </CopyBlock>
                <CopyBlock label="Hashtags">
                  {cap.hashtags}
                </CopyBlock>
              </div>
            ))}
          </div>
        </section>

        {/* ── LAUNCH POSTS ──────────────────────────────── */}
        <section className="mb-20">
          <h3 className="text-2xl font-bold font-heading text-text-primary mb-8">
            Launch Posts
          </h3>

          <div className="space-y-8 max-w-3xl">
            {/* Facebook */}
            <div className="rounded-2xl bg-bg-surface-raised border border-border-subtle p-6">
              <h4 className="text-lg font-semibold font-heading text-text-primary mb-4">
                First Facebook Post
              </h4>
              <CopyBlock label="Post Copy">
                {bio.firstFBPost.copy}
              </CopyBlock>
            </div>

            {/* LinkedIn */}
            <div className="rounded-2xl bg-bg-surface-raised border border-border-subtle p-6">
              <h4 className="text-lg font-semibold font-heading text-text-primary mb-4">
                First LinkedIn Post
              </h4>
              <CopyBlock label="Post Copy">
                {bio.firstLinkedInPost.copy}
              </CopyBlock>
            </div>
          </div>
        </section>
      </Container>
    </main>
  );
}
