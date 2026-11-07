/**
 * Loads the clinic's own public-website wording (the Facebook introduction) into the editable
 * website content, and makes sure its seven services exist with Bangla names and details.
 *
 * Safe to re-run: it only fills fields that are still empty, and never touches prices, doctor
 * details or other services. Pass --force to overwrite fields that already have text.
 *
 *   pnpm db:seed:website
 *
 * The service details are general descriptions written for review by the dentist; edit them in
 * the admin panel (Services > Public website details). No prices, badges or comfort claims are
 * invented here.
 */
import dotenv from "dotenv";

dotenv.config({ path: [".env.local", ".env"], quiet: true });

const force = process.argv.includes("--force");

const CONTENT = {
  clinicName: "Dr Ovi's Dental Care",
  clinicSubtitle: "& Endodontics",
  heroTitleBn: "🦷 আপনার হাসিই আমাদের সবচেয়ে বড় দায়িত্ব।",
  heroTitleEn: "Your smile is our greatest responsibility.",
  heroSubtitleBn: "এখানে প্রতিটি রোগীর জন্য রয়েছে যত্নশীল, আধুনিক এবং মানসম্মত ডেন্টাল চিকিৎসা।",
  heroSubtitleEn: "Every patient receives caring, modern and high-quality dental treatment.",
  technologyBn: "আধুনিক Endomotor, Apex Locator ও Digital X-ray-এর মাধ্যমে আরও নির্ভুল ও আরামদায়ক চিকিৎসা নিশ্চিত করার চেষ্টা করি।",
  technologyEn: "We use a modern Endomotor, Apex Locator and Digital X-ray to provide more precise and comfortable treatment.",
  bookingNoteBn: "অ্যাপয়েন্টমেন্টের জন্য ইনবক্স করুন অথবা ফোন করুন।",
  bookingNoteEn: "To book an appointment, send us a message or call.",
  closingMessageBn: "আপনার সুস্থ ও আত্মবিশ্বাসী হাসির পথচলায় আমরা আছি আপনার পাশে। 💙",
  closingMessageEn: "We are by your side on your journey to a healthy, confident smile. 💙",
  doctorHighlightsEn: ["Specially Trained in Endodontics & Aesthetic Dentistry", "Trained in Dental Implant"],
  doctorHighlightsBn: ["এন্ডোডন্টিক্স ও অ্যাসথেটিক ডেন্টিস্ট্রিতে বিশেষ প্রশিক্ষণপ্রাপ্ত", "ডেন্টাল ইমপ্ল্যান্টে প্রশিক্ষণপ্রাপ্ত"],
} as const;

type SeedService = {
  code: string;
  name: string;
  nameBn: string;
  category: string;
  categoryBn: string;
  iconKey: string;
  detailsEn: string;
  detailsBn: string;
  stepsEn: string[];
  stepsBn: string[];
};

// Prices are left at 0 on purpose ("Contact us for pricing" is shown); set them in Services.
const SERVICES: SeedService[] = [
  {
    code: "RCT",
    name: "Root Canal Treatment (RCT)",
    nameBn: "রুট ক্যানাল ট্রিটমেন্ট (RCT)",
    category: "Endodontics",
    categoryBn: "এন্ডোডন্টিক্স",
    iconKey: "endodontics",
    detailsEn: "Root canal treatment removes infected or inflamed tissue from inside a tooth, cleans and seals the canals, and lets you keep your natural tooth instead of having it extracted. We use a modern Endomotor and Apex Locator for more precise, comfortable care.",
    detailsBn: "রুট ক্যানাল ট্রিটমেন্টে দাঁতের ভেতরের সংক্রমিত বা প্রদাহযুক্ত অংশ পরিষ্কার করে ক্যানাল সিল করা হয়, ফলে দাঁত তুলে ফেলতে হয় না। আধুনিক Endomotor ও Apex Locator ব্যবহার করে চিকিৎসা আরও নির্ভুল ও আরামদায়ক করার চেষ্টা করা হয়।",
    stepsEn: [
      "Examination and digital X-ray to see how far the problem has spread.",
      "Local anaesthesia so the area is numb.",
      "Cleaning and shaping of the root canals with an Endomotor, measured with an Apex Locator.",
      "Disinfecting and filling the canals.",
      "Restoring the tooth with a filling or a crown.",
    ],
    stepsBn: [
      "পরীক্ষা ও ডিজিটাল এক্স-রে করে সমস্যার ব্যাপ্তি দেখা হয়।",
      "স্থানটি অসাড় করতে লোকাল অ্যানেস্থেশিয়া দেওয়া হয়।",
      "Endomotor দিয়ে ক্যানাল পরিষ্কার ও আকার দেওয়া হয়, Apex Locator দিয়ে দৈর্ঘ্য মাপা হয়।",
      "ক্যানাল জীবাণুমুক্ত করে ভরাট করা হয়।",
      "ফিলিং বা ক্রাউন দিয়ে দাঁতটি পুনর্গঠন করা হয়।",
    ],
  },
  {
    code: "FILL",
    name: "Smile Restoration & Aesthetic Filling",
    nameBn: "স্মাইল রিস্টোরেশন ও অ্যাসথেটিক ফিলিং",
    category: "Cosmetic",
    categoryBn: "কসমেটিক ও সৌন্দর্য",
    iconKey: "cosmetic",
    detailsEn: "Smile restoration and aesthetic filling repair chipped, decayed or discoloured teeth with tooth-coloured material that blends with your natural teeth.",
    detailsBn: "দাঁতের রঙের উপাদান দিয়ে ভাঙা, ক্ষয়ে যাওয়া বা দাগযুক্ত দাঁত মেরামত করা হয়, যাতে তা স্বাভাবিক দাঁতের সঙ্গে মিশে যায়।",
    stepsEn: [
      "Examination and choosing the shade that matches your teeth.",
      "Removing decayed or damaged parts of the tooth.",
      "Placing and shaping the tooth-coloured filling.",
      "Polishing for a smooth, natural finish.",
    ],
    stepsBn: [
      "পরীক্ষা এবং দাঁতের সঙ্গে মেলে এমন রং নির্বাচন।",
      "দাঁতের ক্ষয় বা ক্ষতিগ্রস্ত অংশ পরিষ্কার করা।",
      "দাঁতের রঙের ফিলিং বসিয়ে আকার দেওয়া।",
      "মসৃণ ও স্বাভাবিক চেহারার জন্য পলিশ করা।",
    ],
  },
  {
    code: "CROWN",
    name: "Dental Crown (PFM & Zirconia)",
    nameBn: "ডেন্টাল ক্রাউন (PFM ও জিরকোনিয়া)",
    category: "Prosthodontics",
    categoryBn: "প্রস্থোডন্টিক্স",
    iconKey: "smile",
    detailsEn: "A crown is a cap placed over a damaged or weakened tooth to restore its shape, strength and appearance. We offer PFM (porcelain-fused-to-metal) and zirconia crowns.",
    detailsBn: "ক্ষতিগ্রস্ত বা দুর্বল দাঁতের আকার, শক্তি ও সৌন্দর্য ফিরিয়ে আনতে দাঁতের ওপর ক্রাউন বসানো হয়। PFM এবং জিরকোনিয়া, দুই ধরনের ক্রাউনই পাওয়া যায়।",
    stepsEn: [
      "Examination and X-ray to plan the crown.",
      "Preparing the tooth to receive the crown.",
      "Taking an impression of the tooth.",
      "Fitting a temporary crown while the final one is made.",
      "Fitting and adjusting the final crown.",
    ],
    stepsBn: [
      "ক্রাউনের পরিকল্পনার জন্য পরীক্ষা ও এক্স-রে।",
      "ক্রাউন বসানোর জন্য দাঁত প্রস্তুত করা।",
      "দাঁতের মাপ (ইমপ্রেশন) নেওয়া।",
      "চূড়ান্ত ক্রাউন তৈরি হওয়া পর্যন্ত অস্থায়ী ক্রাউন লাগানো।",
      "চূড়ান্ত ক্রাউন বসিয়ে ঠিকঠাক করা।",
    ],
  },
  {
    code: "SCALE",
    name: "Teeth Cleaning & Polishing",
    nameBn: "দাঁত পরিষ্কার ও পলিশিং",
    category: "Preventive",
    categoryBn: "প্রতিরোধমূলক",
    iconKey: "preventive",
    detailsEn: "Professional cleaning removes plaque and tartar that brushing cannot reach, and polishing smooths the tooth surface to help prevent gum disease.",
    detailsBn: "ব্রাশে যা পরিষ্কার হয় না, সেই প্লাক ও টারটার পেশাদারভাবে সরানো হয়। পলিশিং দাঁতের পৃষ্ঠ মসৃণ করে মাড়ির রোগ প্রতিরোধে সাহায্য করে।",
    stepsEn: [
      "Examination of the teeth and gums.",
      "Scaling to remove plaque and tartar.",
      "Polishing the tooth surfaces.",
      "Advice on caring for your teeth at home.",
    ],
    stepsBn: [
      "দাঁত ও মাড়ি পরীক্ষা।",
      "স্কেলিং করে প্লাক ও টারটার অপসারণ।",
      "দাঁতের পৃষ্ঠ পলিশ করা।",
      "বাড়িতে দাঁতের যত্ন নিয়ে পরামর্শ।",
    ],
  },
  {
    code: "WISDOM",
    name: "Wisdom Tooth Extraction",
    nameBn: "আক্কেল দাঁত অপসারণ",
    category: "Surgery",
    categoryBn: "সার্জারি",
    iconKey: "surgery",
    detailsEn: "Wisdom tooth extraction removes a back tooth that is impacted, painful, infected or damaging nearby teeth.",
    detailsBn: "আটকে থাকা, ব্যথাযুক্ত, সংক্রমিত বা পাশের দাঁতের ক্ষতি করছে এমন আক্কেল দাঁত অপসারণ করা হয়।",
    stepsEn: [
      "Examination and X-ray to plan the extraction.",
      "Local anaesthesia so the area is numb.",
      "Careful removal of the tooth.",
      "Aftercare instructions for comfortable healing.",
    ],
    stepsBn: [
      "অপসারণের পরিকল্পনার জন্য পরীক্ষা ও এক্স-রে।",
      "স্থানটি অসাড় করতে লোকাল অ্যানেস্থেশিয়া।",
      "যত্নসহকারে দাঁতটি অপসারণ।",
      "আরামদায়ক সেরে ওঠার জন্য পরবর্তী যত্নের নির্দেশনা।",
    ],
  },
  {
    code: "IMPL",
    name: "Dental Implant",
    nameBn: "ডেন্টাল ইমপ্ল্যান্ট",
    category: "Implant",
    categoryBn: "ইমপ্ল্যান্ট",
    iconKey: "surgery",
    detailsEn: "A dental implant replaces a missing tooth with a titanium root placed in the jawbone, topped with a custom-made crown.",
    detailsBn: "হারানো দাঁতের জায়গায় চোয়ালের হাড়ে টাইটানিয়ামের একটি রুট বসিয়ে তার ওপর মাপমতো ক্রাউন লাগানো হয়।",
    stepsEn: [
      "Assessment and X-ray to check the jawbone and plan the implant.",
      "Placing the implant in the jawbone.",
      "A healing period while the implant settles.",
      "Fitting the abutment and the final crown.",
    ],
    stepsBn: [
      "চোয়ালের হাড় দেখতে ও পরিকল্পনার জন্য পরীক্ষা ও এক্স-রে।",
      "চোয়ালের হাড়ে ইমপ্ল্যান্ট বসানো।",
      "ইমপ্ল্যান্ট স্থির হওয়ার জন্য সেরে ওঠার সময়।",
      "অ্যাবাটমেন্ট ও চূড়ান্ত ক্রাউন লাগানো।",
    ],
  },
  {
    code: "XRAY",
    name: "Digital X-ray",
    nameBn: "ডিজিটাল এক্স-রে",
    category: "Diagnostics",
    categoryBn: "রোগনির্ণয়",
    iconKey: "xray",
    detailsEn: "Digital X-ray gives a clear image of teeth and roots using a low radiation dose, so problems can be found early and treatment planned accurately.",
    detailsBn: "কম মাত্রার রেডিয়েশনে দাঁত ও শিকড়ের স্পষ্ট ছবি পাওয়া যায়, ফলে সমস্যা আগে ধরা পড়ে এবং চিকিৎসা নির্ভুলভাবে পরিকল্পনা করা যায়।",
    stepsEn: [
      "Positioning the small sensor in your mouth.",
      "A very quick exposure.",
      "Reviewing the image on screen together with you.",
    ],
    stepsBn: [
      "মুখে ছোট সেন্সর সঠিক জায়গায় রাখা।",
      "খুব অল্প সময়ের এক্সপোজার।",
      "আপনার সঙ্গে স্ক্রিনে ছবি দেখে আলোচনা।",
    ],
  },
];

const isBlank = (value: unknown) => value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);

async function main() {
  if (process.env.NODE_ENV === "production" && !process.argv.includes("--allow-production")) {
    throw new Error("Refusing to run in production without --allow-production.");
  }
  const { prisma } = await import("../src/lib/prisma");
  try {
    // Website text: fill only what is empty (unless --force).
    const existing = await prisma.clinicContent.findUnique({ where: { id: "primary" } });
    const data: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(CONTENT)) {
      const current = existing ? (existing as Record<string, unknown>)[key] : undefined;
      if (force || current === undefined || isBlank(current)) data[key] = Array.isArray(value) ? [...(value as readonly string[])] : (value as string);
    }
    await prisma.clinicContent.upsert({ where: { id: "primary" }, create: { id: "primary", ...data }, update: data });
    console.log(`Website content: ${Object.keys(data).length} field(s) filled.`);

    // Services: match by code, then by name. Existing ones only gain what they are missing.
    let created = 0;
    let updated = 0;
    for (const service of SERVICES) {
      const found = await prisma.clinicService.findFirst({
        where: { OR: [{ code: service.code }, { name: { equals: service.name, mode: "insensitive" } }] },
      });
      if (!found) {
        await prisma.clinicService.create({ data: { ...service, standardPrice: 0, durationMinutes: 30 } });
        created += 1;
        continue;
      }
      const presentation = Object.fromEntries(Object.entries(service).filter(([key]) => !["code", "name", "category"].includes(key)));
      const missing = Object.fromEntries(
        Object.entries(presentation).filter(([key, value]) => force || isBlank((found as Record<string, unknown>)[key]) ? value !== undefined : false),
      );
      if (Object.keys(missing).length) {
        await prisma.clinicService.update({ where: { id: found.id }, data: missing });
        updated += 1;
      }
    }
    console.log(`Services: ${created} created, ${updated} completed with Bangla text and details.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
