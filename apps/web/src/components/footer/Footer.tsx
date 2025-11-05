import Image from 'next/image';
import Link from 'next/link';

const Footer = () => (
  <footer className="bg-gradient-to-r from-[#1C1D1F] to-[#3C0138] bg-[length:150%_100%] py-8 md:py-8 pb-16 sm:pb-24">
    {/* First Row */}
    <div className="flex px-10 border-b pb-5 flex-col md:flex-row justify-between items-center md:space-x-6">
      <div className="flex items-center mb-6 md:mb-0">
        {/* Icon Image */}
        <Image
          src="/logo.jpg" // Change the image source to your icon
          alt="Icon"
          width={40}
          height={40}
          className="rounded-full"
        />
        {/* "Our Teachers" Text */}
        <p className="ml-4 text-white text-xl">Free শিক্ষা ঘরে ঘরে পৌছিয়ে দাওয়ার জন্যে আপ্রাণ চেষ্টা করে যাচ্ছি!</p>
      </div>

      {/* Flags Icons (6 images) */}
      <div>
        <div>
          <p style={{fontSize:"24px"}} className='text-white text-center text-lg'>Our teachers from</p>
        </div>
        <div className="flex space-x-4 overflow-x-auto mt-2">
          <Image src="/icons-flags/freedom.png" alt="Flag 1" width={40} height={40} />
          <Image src="/icons-flags/canada.png" alt="Flag 2" width={40} height={40} />
          <Image src="/icons-flags/austalia.png" alt="Flag 3" width={40} height={40} />
          <Image src="/icons-flags/gemrany.png" alt="Flag 4" width={40} height={40} />
          <Image src="/icons-flags/italy.png" alt="Flag 5" width={40} height={40} />
          <Image src="/icons-flags/danemark.png" alt="Flag 6" width={40} height={40} />
          <Image src="/icons-flags/british.png" alt="Flag 7" width={40} height={40} />
        </div>
      </div>
    </div>

    {/* Second Row */}
    <div className="flex px-10 flex-col md:flex-row justify-between mt-8">
      {/* List of 3 items */}
      <div className="flex w-full mb-6 md:mb-0 flex-col sm:flex-row sm:ml-10 sm:space-x-20 sm:flex-nowrap sm:items-start items-center text-center sm:text-left mx-auto">
  <ul className="text-white space-y-2">
    <li>
      <Link href="/privacy-policy" className="hover:underline">
        Privacy Policy
      </Link>
    </li>
    <li>
      <Link href="/terms-conditions" className="hover:underline">
        Terms & Condition
      </Link>
    </li>
    <li>
      <Link href="/refund-policy" className="hover:underline">
        Refund Policy
      </Link>
    </li>
  </ul>
  <ul className="text-white space-y-2 mt-4 sm:mt-0 sm:ml-0">
    <li>
      <Link href="/contact-us" className="hover:underline">
        Contact Us
      </Link>
    </li>
    <li>
      <Link href="/report-abuse" className="hover:underline">
        Report Abuse
      </Link>
    </li>
    <li>
      <Link href="/bug-hunt-rewards" className="hover:underline">
        Bug Hunt Rewards
      </Link>
    </li>
  </ul>
</div>


      {/* Founder & CEO Section */}

      {/* <div className="flex flex-col justify-end md:flex-row items-center md:items-top text-right md:text-right space-y-4 md:space-y-0">
     
        <div className="mr-3 mb-4 md:mb-0">
          <Image src="/alam.png" alt="Founder & CEO" width={93} height={93} className="rounded-full mx-auto md:mr-3 mt-2" />
        </div>

        <div className="w-full md:w-[70%] text-center  md:text-left">
          <p className="text-white text-left text-xl">Founder & CEO সাদমান ভাই</p>
          <p className="bg-white mb-5 text-sm text-left ml-auto text-black rounded p-3 mt-2">
            Free শিখবেন এখানে কোন চার্জ নেই, নিম্নবিত্ত পরিবার থেকে হাজারও শিক্ষার্থী টাকার অভাবে আগাতে পারছে না! তাই
            help করতে চাই সবায়কে যেন স্বল্প খরচে Bangladesh সেরা শিক্ষা ঘরে ঘরে পৌছিয়ে যায়! <br />
            CEO এর সাথে সরাসরি যোগাযোগ করুনঃ <span style={{fontSize:"14px", fontWeight:"400"}} className="text-green-700 font-weight">CEO@freebaj.net</span>
          </p>
        </div>
      </div> */}

    </div>
  </footer>
);

export default Footer;
