const teamData = [
  {
    title: 'Founder & CEO',
    members: ['Sadman Vai', 'Afnan Sadia'],
  },
  {
    title: 'Developers',
    members: ['Osama', 'Marwane', 'Ritesh', 'Opshori'],
  },
  {
    title: 'Teachers',
    members: ['Sadman Vai', 'Rongon', 'Sukhon', 'Arman', 'Murshid'],
  },
  {
    title: 'Marketing',
    members: ['Ravesh Nathi', 'Imran Sheikh'],
  },
  {
    title: 'Security & Legal',
    members: ['Keim Butch', 'Dr. Pramanik Kumar'],
  },
];

export default function ContactPage() {
  return (
    <main className="min-h-screen ">
      {/* Gradient Header */}
      <section className="py-12 px-8">
        <h1
          style={{
            background: 'linear-gradient(to right, rgba(217,116,219,1), rgba(56,0,153,1))',
            fontWeight: 500,
            fontSize: 'clamp(24px, 5vw, 40px)',
            borderRadius: '2px',
          }}
          className="w-full lg:w-fit px-3 py-2 text-white mb-4 text-center lg:text-left"
        >
          Contact Us
        </h1>

        <p
          className="text-left text-lg sm:text-xl"
          style={{
            width: '70%',
            maxWidth: '100%',
            color: "rgba(58, 58, 58, 1)"
          }}
        >
          Freebaj provides 24/7 support. To contact us please send an email to&nbsp;
          <a href="mailto:support@freebaj.net" style={{ color: 'rgba(255, 0, 0, 1)', textDecoration: 'none' }}>
            support@freebaj.net
          </a>
          . We will get back to you as soon as possible.
        </p>
        <h2
          style={{
            background: 'linear-gradient(to right, rgba(217,116,219,1), rgba(56,0,153,1))',
            fontWeight: 500,
            fontSize: 'clamp(24px, 5vw, 40px)',
            borderRadius: '2px',
          }}
          className="w-full lg:w-fit px-4 py-3 text-white font-semibold mt-12 mb-6 text-center lg:text-left"
        >
          Meet Our Team Members
        </h2>
        <div className="grid gap-6 w-[70%] mx-auto md:mr-auto md:ml-0 justify-items-center sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {teamData.map((group, index) => (
            <div key={index} className="text-lg font-medium w-full max-w-[220px]">
              <div className="bg-[rgba(255,0,0,1)] text-center rounded-[15px] px-3 py-2 text-white">{group.title}</div>
              <ol style={{color: "rgba(58, 58, 58, 1)"}} className="mt-3 ml-5 list-decimal space-y-1 text-left">
                {group.members.map((member, idx) => (
                  <li key={idx}>{member}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
