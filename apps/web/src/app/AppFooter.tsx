import Link from "next/link";

const footerGroups = [
  {
    heading: "Lorem",
    links: [
      { href: "#", label: "Ipsum dolor" },
      { href: "#", label: "Sit amet" },
      { href: "#", label: "Consectetur" },
    ],
  },
  {
    heading: "Adipiscing",
    links: [
      { href: "#", label: "Elit sed" },
      { href: "#", label: "Do eiusmod" },
      { href: "#", label: "Tempor" },
    ],
  },
  {
    heading: "Incididunt",
    links: [
      { href: "#", label: "Ut labore" },
      { href: "#", label: "Et dolore" },
      { href: "#", label: "Magna aliqua" },
    ],
  },
] as const;

export function AppFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="app-footer-inner">
        <div className="app-footer-brand">&copy; {currentYear} AssetX</div>
        <nav className="app-footer-groups" aria-label="Footer navigation">
          {footerGroups.map((group) => (
            <section className="app-footer-group" key={group.heading}>
              <h2>{group.heading}</h2>
              <ul>
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
      </div>
    </footer>
  );
}
