export default function ContactPage() {
  return (
    <main className="min-h-screen ">
      {/* Gradient Header */}
      <section className="pt-8 pb-1 px-8">
        <h1
          style={{
            background: 'linear-gradient(to right, rgba(217,116,219,1), rgba(56,0,153,1))',
            fontWeight: 500,
            fontSize: 'clamp(24px, 5vw, 40px)',
            borderRadius: '2px',
          }}
          className="w-full lg:w-fit px-3 py-2 text-white mb-4 text-center lg:text-left"
        >
          Bug Hunt Reward
        </h1>

        <p
          className="text-left pb-5 text-lg sm:text-xl"
          style={{
            maxWidth: '100%',
            color: 'rgba(58, 58, 58, 1)',
          }}
        >
          We pay an exceptionally good amount as a reward to bug hunters. Anyone can send us a valid bug hunting report
          or problem & get rewarded.
        </p>

        <ol style={{ color: 'rgba(58, 58, 58, 1)' }} className="list-decimal px-4 mb-3 py-2">
          <li>Small Problems ($50-$100)</li>
          <li> Mid Level Bugs or Problems ($100-$200)</li>
          <li> Advance Bugs or Big problems ($200-$1000+)</li>
        </ol>
        <p
          className="text-left text-lg sm:text-xl"
          style={{
            maxWidth: '100%',
            color: 'rgba(58, 58, 58, 1)',
          }}
        >
       To report bug hunting problem and collect rewards send us an email at
          <a
            className="mx-2"
            href="mailto:support@freebaj.net"
            style={{ color: 'rgba(255, 0, 0, 1)', textDecoration: 'none' }}
          >
            support@freebaj.net
          </a>
        </p>
      </section>
    </main>
  );
}
