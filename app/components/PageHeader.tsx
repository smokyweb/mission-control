import Image from "next/image";

const PAGE_ICONS: Record<string, string> = {
  "Calendar":         "/icons/icon-7.png",
  "Tasks":            "/icons/icon-17.png",
  "Conversations":    "/icons/icon-5.png",
  "Search":           "/icons/icon-14.png",
  "Activity Feed":    "/icons/icon-4.png",
  "Content Pipeline": "/icons/icon-15.png",
  "Memory":           "/icons/icon-8.png",
  "Team":             "/icons/icon-10.png",
  "Office":           "/icons/icon-16.png",
};

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: string; // fallback emoji, ignored if we have a mapped image
}

export default function PageHeader({ title, subtitle }: PageHeaderProps) {
  const imgSrc = PAGE_ICONS[title];

  return (
    <div
      style={{
        background: "#f5c200",
        padding: "20px 32px",
        borderBottom: "3px solid #000",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        {imgSrc && (
          <Image
            src={imgSrc}
            alt={title}
            width={32}
            height={32}
            style={{ filter: "brightness(0)", flexShrink: 0 }}
          />
        )}
        <div>
          <h1
            style={{
              color: "#000",
              fontWeight: 800,
              fontSize: "22px",
              letterSpacing: "0.04em",
              margin: 0,
              lineHeight: 1.1,
              textTransform: "uppercase",
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              style={{
                color: "rgba(0,0,0,0.55)",
                fontSize: "12px",
                margin: "4px 0 0",
                letterSpacing: "0.03em",
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
