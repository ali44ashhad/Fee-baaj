export default function ContactPage() {
  return (
    <main className="min-h-screen ">
      {/* Gradient Header */}
      <section className="py-8 px-8">
        <h1
          style={{
            background: 'linear-gradient(to right, rgba(217,116,219,1), rgba(56,0,153,1))',
            fontWeight: 500,
            fontSize: 'clamp(24px, 5vw, 40px)',
            borderRadius: '2px',
          }}
          className="w-full lg:w-fit px-3 py-2 text-white mb-4 text-center lg:text-left"
        >
          Report Abuse
        </h1>

        <p
          className="text-left pb-5 text-lg sm:text-xl"
          style={{
            maxWidth: '100%',
            color: 'rgba(58, 58, 58, 1)',
          }}
        >
          We take any types of abuse very seriously. Please email us at 
          <a className="mx-2" href="mailto:support@freebaj.net" style={{ color: 'rgba(255, 0, 0, 1)', textDecoration: 'none' }}>
            support@freebaj.net
          </a>
          to report an abuse. We will get back to you as soon as possible. You can report abuse to us regarding
        </p>

        <ol style={{color: "rgba(58, 58, 58, 1)"}} className="list-decimal px-4 mb-3 py-2">
          <li>Copyright</li>
          <li>Inappropriate behaviors</li>
          <li>Child pornographic content</li>
          <li>Abusive content & material</li>
          <li>Any other concerning thing that might need our attention</li>
        </ol>
        <p
          className="text-left text-lg sm:text-xl"
          style={{
            maxWidth: '100%',
            color: 'rgba(58, 58, 58, 1)',
          }}
        >
          We try to keep the internet a safe place for everyone. Help us by sending an email at
          <a className="mx-2" href="mailto:support@freebaj.net" style={{ color: 'rgba(255, 0, 0, 1)', textDecoration: 'none' }}>
            support@freebaj.net
          </a>
        </p>
      </section>
    </main>
  );
}
