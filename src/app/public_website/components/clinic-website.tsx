"use client";

import Image from "next/image";
import { useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  Phone,
  Smile,
  Sparkles,
  Stethoscope,
  X,
} from "lucide-react";
import Modal from "@/components/shared/modal";
import BookingForm from "./booking-form";
import LayoutIcon from "./layout-icons";
import PublicHeader from "./public-header";
import PublicServices from "./public-services";
import { localize, PublicLanguageProvider, usePublicLanguage } from "./public-language";
import ReviewsSection from "./reviews-section";
import { NAV_ANCHORS, NAV_KEYS, resolveLayout, type Bilingual } from "@/modules/website/schemas/website-layout";
import type { ClinicDoctor, ClinicGalleryImage, ClinicService, PublicClinicData } from "./types";

const weekdayNames = {
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  bn: ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"],
};

function formatTime(value: string, language: "en" | "bn") {
  const [hour, minute] = value.split(":").map(Number);
  const displayHour = hour % 12 || 12;
  const period = hour >= 12 ? "PM" : "AM";
  const locale = language === "bn" ? "bn-BD" : "en-US";
  return `${new Intl.NumberFormat(locale).format(displayHour)}:${new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, useGrouping: false }).format(minute)} ${period}`;
}

function phoneLinks(phone: string | null) {
  if (!phone) return { tel: null, whatsapp: null };
  const digits = phone.replace(/\D/g, "");
  const whatsapp = digits.startsWith("0")
    ? `88${digits}`
    : digits.startsWith("880") ? digits
      : digits.startsWith("1") ? `880${digits}` : null;
  return { tel: phone.replace(/[^\d+]/g, ""), whatsapp };
}

function ClinicSchedule({ doctor, language }: { doctor: ClinicDoctor | null; language: "en" | "bn" }) {
  const schedules = doctor?.schedules ?? [];
  return (
    <div className="space-y-1 rounded-2xl border border-purple-100 bg-white p-4 shadow-sm">
      {schedules.length ? schedules.map((schedule) => (
        <div key={schedule.dayOfWeek} className="flex justify-between gap-4 border-b border-purple-50 py-2 last:border-0">
          <span className="font-bold text-slate-700">{weekdayNames[language][schedule.dayOfWeek]}:</span>
          <span className={schedule.isWorking ? "text-right font-semibold text-purple-700" : "text-right font-bold text-rose-500"}>
            {schedule.isWorking ? `${formatTime(schedule.startTime, language)} – ${formatTime(schedule.endTime, language)}` : localize(language, "Closed", "সাপ্তাহিক বন্ধ")}
          </span>
        </div>
      )) : <p className="py-2 text-sm text-slate-600">{localize(language, "Hours have not been set yet.", "সময়সূচি এখনো নির্ধারণ করা হয়নি।")}</p>}
    </div>
  );
}

export default function ClinicWebsite(props: {
  clinic: PublicClinicData;
  galleryImages: ClinicGalleryImage[];
}) {
  return (
    <PublicLanguageProvider>
      <ClinicWebsiteContent {...props} />
    </PublicLanguageProvider>
  );
}

function ClinicWebsiteContent({
  clinic,
  galleryImages,
}: {
  clinic: PublicClinicData;
  galleryImages: ClinicGalleryImage[];
}) {
  const { language } = usePublicLanguage();
  const [bookingServiceId, setBookingServiceId] = useState("");
  const [mobileActive, setMobileActive] = useState("home");
  const [viewingImage, setViewingImage] = useState<ClinicGalleryImage | null>(null);

  const doctor = clinic.doctor;
  const services = clinic.services;
  const content = clinic.content;
  // Menu labels, headings, feature cards and footer: the clinic's changes over the built-in wording.
  const layout = resolveLayout(content.layout);
  const t = (value: Bilingual) => value[language];
  // Text managed in the admin panel (Website content). Empty means "use the built-in wording".
  const custom = (en: string, bn: string) => (language === "bn" ? bn : en).trim();
  const clinicName = content.clinicName.trim() || "Dr Ovi's Dental Care";
  const clinicSubtitle = content.clinicSubtitle.trim() || "& Endodontics";
  const heroTitle = custom(content.heroTitleEn, content.heroTitleBn);
  const heroSubtitle = custom(content.heroSubtitleEn, content.heroSubtitleBn);
  const technology = custom(content.technologyEn, content.technologyBn);
  const bookingNote = custom(content.bookingNoteEn, content.bookingNoteBn);
  const closingMessage = custom(content.closingMessageEn, content.closingMessageBn);
  const ownHighlights = language === "bn" ? content.doctorHighlightsBn : content.doctorHighlightsEn;
  const otherHighlights = language === "bn" ? content.doctorHighlightsEn : content.doctorHighlightsBn;
  const highlights = ownHighlights.length ? ownHighlights : otherHighlights;
  const heroImage = content.heroImageUrl || "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1000&q=85";
  const doctorImage = content.doctorImageUrl || "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=1000&q=85";
  const { tel, whatsapp } = phoneLinks(doctor?.phone ?? null);
  function bookService(service: ClinicService) {
    setBookingServiceId(service.id);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("appointment")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }
  // The clinic's own Google Maps link (managed in Website content) wins; without one the map is
  // searched from the address on the doctor profile.
  const mapUrl = layout.mapEmbedUrl
    || (doctor?.address ? `https://www.google.com/maps?q=${encodeURIComponent(doctor.address)}&output=embed` : null);
  const openMapUrl = layout.mapUrl
    || (doctor?.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(doctor.address)}` : null);

  return (
    <div data-public-site className="min-h-screen bg-purple-50/30 pb-24 text-slate-800 antialiased md:pb-0" lang={language}>
      <PublicHeader
        phone={doctor?.phone ?? null}
        clinicName={clinicName}
        clinicSubtitle={clinicSubtitle}
        navItems={NAV_KEYS.filter((key) => layout.nav[key].visible).map((key) => ({ anchor: NAV_ANCHORS[key], label: layout.nav[key].label }))}
      />
      <main>
        <section id="home" className="overflow-hidden border-b border-purple-100 bg-gradient-to-br from-purple-100 via-purple-50 to-white py-10 md:py-20">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
            <div className="space-y-6 lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-white/90 px-4 py-2 text-xs font-semibold text-purple-900 shadow-sm">
                <Stethoscope size={15} className="text-purple-700" /> {t(layout.heroBadge)}
              </div>
              <h1 className="text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
                {heroTitle || (<>
                  {localize(language, "Care for your health and beautiful smile at ", "আপনার সুস্বাস্থ্য ও সুন্দর হাসির যত্নে ")}<span className="text-purple-700">{content.clinicName.trim() ? `${clinicName} ${clinicSubtitle}` : `${doctor?.name ?? "Dr Ovi"}'s Dental Care & Endodontics`}</span>
                </>)}
              </h1>
              <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-700">
                {doctor?.qualifications && <span className="rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-purple-900">{doctor.qualifications}</span>}
                {doctor?.specialization && <span className="rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-purple-900">{doctor.specialization}</span>}
              </div>
              <p className="max-w-2xl text-base leading-relaxed text-slate-600">
                {heroSubtitle || doctor?.bio || localize(language, "Request an appointment for dental care and advice tailored to your needs.", "চিকিৎসার প্রয়োজন অনুযায়ী পরামর্শ ও ডেন্টাল সেবা পেতে অ্যাপয়েন্টমেন্টের অনুরোধ পাঠান।")}
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <a href="#appointment" className="inline-flex items-center gap-2 rounded-full bg-purple-700 px-6 py-3.5 font-semibold text-white shadow-lg shadow-purple-700/25 transition-colors hover:bg-purple-800">{localize(language, "Book an appointment", "অ্যাপয়েন্টমেন্ট নিন")} <CalendarDays size={17} /></a>
                <a href="#services" className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-white px-6 py-3.5 font-semibold text-purple-800 transition-colors hover:bg-purple-50">{localize(language, "Explore services", "চিকিৎসাসমূহ দেখুন")} <ArrowRight size={17} /></a>
              </div>
              <div className="flex flex-wrap gap-5 border-t border-purple-200/70 pt-5 text-sm text-slate-600">
                {layout.heroChips.map((chip, index) => (
                  <span key={`${index}-${chip.en}`} className="inline-flex items-center gap-2">
                    {index % 2 === 0 ? <CheckCircle2 size={17} className="text-emerald-600" /> : <Clock3 size={17} className="text-purple-700" />} {t(chip)}
                  </span>
                ))}
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-xl lg:col-span-5">
              <div className="overflow-hidden rounded-3xl border-4 border-white bg-purple-900 shadow-2xl">
                <Image src={heroImage} alt={localize(language, "Dental clinic", "ডেন্টাল ক্লিনিক")} width={1000} height={700} priority unoptimized className="h-72 w-full object-cover sm:h-[390px]" />
                <div className="flex items-center justify-between gap-4 bg-gradient-to-r from-purple-950 to-purple-800 p-4 text-white">
                  <div>
                    <h2 className="font-bold">{doctor?.name ?? "Dr Ovi"}</h2>
                    <p className="mt-0.5 text-xs text-purple-200">{doctor?.specialization || "Dental Care"}</p>
                  </div>
                  <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold">{localize(language, "Book an appointment", "অ্যাপয়েন্টমেন্ট নিন")}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="bg-white py-16 md:py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div className="overflow-hidden rounded-3xl border border-purple-100 bg-purple-900 shadow-xl">
              <Image src={doctorImage} alt={`${doctor?.name ?? "Dr Ovi"} — ${localize(language, "Dentist", "ডেন্টাল চিকিৎসক")}`} width={1000} height={700} unoptimized className="h-72 w-full object-cover sm:h-[430px]" />
            </div>
            <div className="space-y-5">
              <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-purple-800">{localize(language, "Meet the dentist", "চিকিৎসক পরিচিতি")}</span>
              <h2 className="text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">{doctor?.name ?? "Dr Ovi"}</h2>
              <p className="text-sm font-semibold text-purple-700">{[doctor?.qualifications, doctor?.specialization].filter(Boolean).join(" · ") || "Dental Care"}</p>
              {highlights.length > 0 && (
                <ul className="space-y-1.5 text-sm font-medium text-slate-700">
                  {highlights.map((line) => <li key={line} className="flex items-start gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" /> {line}</li>)}
                </ul>
              )}
              <p className="text-base leading-relaxed text-slate-600">{doctor?.bio || localize(language, "Contact us or request an appointment to learn more about the dentist and clinic.", "চিকিৎসক ও ক্লিনিক সম্পর্কে বিস্তারিত জানতে যোগাযোগ করুন অথবা অ্যাপয়েন্টমেন্টের অনুরোধ পাঠান।")}</p>
              <div className="grid gap-3 pt-2 sm:grid-cols-2">
                {layout.aboutCards.map((item, index) => (
                  <div key={`${index}-${item.title.en}`} className="flex items-start gap-3 rounded-2xl border border-purple-100 bg-purple-50/60 p-4">
                    <span className="mt-0.5 text-purple-700"><LayoutIcon name={item.icon} size={20} /></span>
                    <span><strong className="block text-sm text-slate-900">{t(item.title)}</strong>{t(item.text) && <span className="mt-1 block text-xs leading-relaxed text-slate-500">{t(item.text)}</span>}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="services" className="bg-purple-50/50 py-12 md:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-8 max-w-2xl text-center md:mb-10">
              <span className="inline-block rounded-full bg-purple-100 px-3 py-1.5 text-xs font-bold uppercase leading-normal tracking-wide text-purple-800">{t(layout.sections.services.badge)}</span>
              <h2 className="mt-4 text-3xl font-bold leading-tight text-slate-900 sm:text-4xl"><span className="site-title">{t(layout.sections.services.title)}</span></h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">{t(layout.sections.services.subtitle)}</p>
            </div>
            <PublicServices services={services} onBook={bookService} />
          </div>
        </section>

        {layout.sections.gallery.visible && (
        <section id="gallery" className="bg-white py-16 md:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-9 text-center">
              <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-800">{t(layout.sections.gallery.badge)}</span>
              <h2 className="mt-4 text-3xl font-bold text-slate-900 sm:text-4xl"><span className="site-title">{t(layout.sections.gallery.title)}</span></h2>
              {t(layout.sections.gallery.subtitle) && <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">{t(layout.sections.gallery.subtitle)}</p>}
            </div>
            {galleryImages.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {galleryImages.map((image) => (
                <figure key={image.id} className="group overflow-hidden rounded-2xl border border-purple-100 bg-purple-50">
                  <button
                    type="button"
                    className="block w-full cursor-zoom-in text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-700"
                    aria-label={localize(language, `View image larger: ${image.altText}`, `ছবিটি বড় করে দেখুন: ${image.altText}`)}
                    aria-haspopup="dialog"
                    onClick={() => setViewingImage(image)}
                  >
                    <Image src={image.url} alt={image.altText} width={900} height={650} unoptimized className="h-48 w-full object-cover transition-transform duration-500 group-hover:scale-105 sm:h-56" />
                  </button>
                </figure>
              ))}
            </div>
            ) : (
              <p className="rounded-2xl border border-purple-100 bg-purple-50 px-4 py-10 text-center text-sm text-slate-500">{localize(language, "No images have been added to the gallery yet.", "গ্যালারিতে কোনো ছবি যোগ করা হয়নি।")}</p>
            )}
          </div>
        </section>
        )}

        {layout.sections.whyUs.visible && (
        <section id="why-us" className="bg-purple-950 py-16 text-white md:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <span className="rounded-full border border-purple-700 bg-purple-900 px-3 py-1 text-xs font-bold text-purple-200">{t(layout.sections.whyUs.badge)}</span>
              <h2 className="mt-4 text-3xl font-bold sm:text-4xl"><span className="site-title site-title-dark">{t(layout.sections.whyUs.title)}</span></h2>
              <p className="mt-3 text-sm leading-relaxed text-purple-200">{t(layout.sections.whyUs.subtitle)}</p>
              {technology && <p className="mt-4 rounded-xl border border-purple-800 bg-purple-900/60 px-4 py-3 text-sm leading-relaxed text-white">{technology}</p>}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {layout.whyCards.map((item, index) => (
                <article key={`${index}-${item.title.en}`} className="rounded-2xl border border-purple-800 bg-purple-900/60 p-6">
                  <span className="mb-4 grid size-11 place-items-center rounded-xl bg-purple-700 text-white"><LayoutIcon name={item.icon} size={22} /></span>
                  <h3 className="font-bold">{t(item.title)}</h3>
                  {t(item.text) && <p className="mt-2 text-sm leading-relaxed text-purple-200">{t(item.text)}</p>}
                </article>
              ))}
            </div>
            <div className="mt-9 text-center">
              {closingMessage && <p className="mx-auto mb-5 max-w-2xl text-base font-medium leading-relaxed text-white">{closingMessage}</p>}
              <a href="#appointment" className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-bold text-purple-900 transition-colors hover:bg-purple-100">{localize(language, "Book an appointment", "অ্যাপয়েন্টমেন্ট নিন")} <ArrowRight size={17} /></a>
            </div>
          </div>
        </section>
        )}

        {layout.sections.reviews.visible && <ReviewsSection badge={t(layout.sections.reviews.badge)} title={t(layout.sections.reviews.title)} subtitle={t(layout.sections.reviews.subtitle)} />}
        <BookingForm doctor={doctor} services={services} note={bookingNote} requestedServiceId={bookingServiceId} badge={t(layout.sections.booking.badge)} title={t(layout.sections.booking.title)} subtitle={t(layout.sections.booking.subtitle)} />

        <section id="contact" className="border-t border-purple-100 bg-purple-50/50 py-16 md:py-24">
          <div className="mx-auto grid max-w-7xl items-start gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div className="space-y-6">
              <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-800">{t(layout.sections.contact.badge)}</span>
              <h2 className="text-3xl font-bold text-slate-900"><span className="site-title">{t(layout.sections.contact.title) || clinicName}</span></h2>
              {t(layout.sections.contact.subtitle) && <p className="text-sm leading-relaxed text-slate-600 sm:text-base">{t(layout.sections.contact.subtitle)}</p>}
              <ClinicSchedule doctor={doctor} language={language} />
              <div className="space-y-4 text-sm">
                <p className="flex items-start gap-3"><MapPin size={19} className="mt-0.5 shrink-0 text-purple-700" /><span><strong className="block text-slate-900">{localize(language, "Clinic address", "চেম্বারের ঠিকানা")}</strong><span className="text-slate-600">{doctor?.address || localize(language, "Contact the clinic for the address.", "ঠিকানা জানতে ক্লিনিকে যোগাযোগ করুন")}</span></span></p>
                <p className="flex items-start gap-3"><Phone size={18} className="mt-0.5 shrink-0 text-purple-700" /><span><strong className="block text-slate-900">{localize(language, "Appointment hotline", "সিরিয়াল হেল্পলাইন")}</strong>{tel ? <a href={`tel:${tel}`} className="text-slate-600 hover:text-purple-800">{doctor?.phone}</a> : <span className="text-slate-600">{localize(language, "Phone number unavailable", "ফোন নম্বর পাওয়া যায়নি")}</span>}</span></p>
              </div>
              <div className="flex flex-wrap gap-3">
                {tel && <a href={`tel:${tel}`} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-purple-950 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-900"><Phone size={16} /> {localize(language, "Call us", "কল করুন")}</a>}
                {whatsapp && <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700">WhatsApp</a>}
                {layout.facebookUrl && <a href={layout.facebookUrl} target="_blank" rel="noopener noreferrer" className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800">Facebook</a>}
              </div>
            </div>
            <div className="overflow-hidden rounded-3xl border border-purple-100 bg-white p-3 shadow-xl">
              {mapUrl ? (
                <iframe title={localize(language, "Clinic map", "ক্লিনিকের মানচিত্র")} src={mapUrl} className="h-80 w-full rounded-2xl border-0 sm:h-96" loading="lazy" allowFullScreen referrerPolicy="no-referrer-when-downgrade" />
              ) : (
                <div className="grid h-80 place-items-center rounded-2xl bg-slate-100 px-6 text-center text-sm text-slate-500 sm:h-96">{localize(language, "Add the clinic address under Doctors in the admin panel to show the map here.", "Admin panel-এর Doctors অংশে ক্লিনিকের ঠিকানা যোগ করলে মানচিত্র এখানে দেখা যাবে।")}</div>
              )}
              {openMapUrl && (
                <a href={openMapUrl} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-purple-50 px-4 py-2.5 text-sm font-semibold text-purple-800 hover:bg-purple-100">
                  <MapPin size={16} /> {localize(language, "Open in Google Maps", "Google Maps-এ খুলুন")}
                </a>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-purple-950 py-9 text-purple-200">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div>
            <p className="text-lg font-bold text-white">{clinicName} {clinicSubtitle}</p>
            <p className="mt-1 text-xs">{doctor?.name ?? "Dr Ovi"}{doctor?.specialization ? ` · ${doctor.specialization}` : ""}</p>
            {t(layout.footerNote) && <p className="mt-2 max-w-sm text-xs leading-relaxed">{t(layout.footerNote)}</p>}
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium" aria-label={localize(language, "Footer navigation", "ফুটার নেভিগেশন")}>
            <a href="#home" className="hover:text-white">{t(layout.nav.home.label)}</a>
            <a href="#services" className="hover:text-white">{t(layout.nav.services.label)}</a>
            <a href="#appointment" className="hover:text-white">{localize(language, "Appointments", "অ্যাপয়েন্টমেন্ট")}</a>
            <a href="#contact" className="hover:text-white">{t(layout.nav.contact.label)}</a>
            {layout.facebookUrl && <a href={layout.facebookUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white">Facebook</a>}
          </nav>
          <p className="text-xs">{clinicName}</p>
        </div>
      </footer>

      <nav className="fixed inset-x-4 bottom-4 z-40 flex items-center justify-around rounded-full border border-purple-200/80 bg-white/95 px-3 py-2 shadow-[0_12px_35px_-6px_rgba(88,28,135,0.25)] backdrop-blur-lg md:hidden" aria-label={localize(language, "Quick navigation", "মোবাইল দ্রুত নেভিগেশন")}>
        {[
          ["home", localize(language, "Home", "হোম"), <Smile size={19} key="i" />],
          ["appointment", localize(language, "Book", "সিরিয়াল"), <CalendarDays size={19} key="i" />],
          ["services", localize(language, "Services", "সেবা"), <Sparkles size={19} key="i" />],
          ["contact", localize(language, "Contact", "যোগাযোগ"), <Phone size={18} key="i" />],
        ].map(([id, label, icon]) => (
          <a key={String(id)} href={`#${id}`} onClick={() => setMobileActive(String(id))} aria-label={String(label)} className={`grid size-12 place-items-center rounded-full transition-colors ${mobileActive === id ? "bg-amber-100 text-amber-600" : "text-purple-900 hover:bg-purple-50"}`}>
            {icon}
          </a>
        ))}
      </nav>

      {viewingImage && (
        <Modal
          className="gallery-image-modal"
          labelledBy="gallery-image-title"
          onRequestClose={() => setViewingImage(null)}
        >
          <div className="gallery-image-modal-content">
            <div className="gallery-image-modal-heading">
              <h2 id="gallery-image-title">{viewingImage.altText}</h2>
              <button
                type="button"
                className="icon-button gallery-image-close"
                onClick={() => setViewingImage(null)}
                aria-label={localize(language, "Close image", "ছবি বন্ধ করুন")}
              >
                <X size={18} />
              </button>
            </div>
            <Image
              src={viewingImage.url}
              alt={viewingImage.altText}
              width={1600}
              height={1200}
              unoptimized
              className="gallery-image-expanded"
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
