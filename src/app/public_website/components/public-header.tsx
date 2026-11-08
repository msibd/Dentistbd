"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, LogIn, Menu, Phone, Smile, X } from "lucide-react";
import { localize, usePublicLanguage } from "./public-language";
import type { Bilingual } from "@/modules/website/schemas/website-layout";



export default function PublicHeader({ phone, clinicName, clinicSubtitle, navItems }: { phone: string | null; clinicName: string; clinicSubtitle: string; navItems: { anchor: string; label: Bilingual; href?: string }[] }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { language, setLanguage } = usePublicLanguage();
  const tel = phone?.replace(/[^\d+]/g, "");
  const languageToggle = (
    <div className="inline-flex shrink-0 rounded-full border border-purple-200 p-0.5" role="group" aria-label={localize(language, "Choose language", "ভাষা নির্বাচন করুন")}>
      <button type="button" onClick={() => setLanguage("en")} aria-pressed={language === "en"} className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${language === "en" ? "bg-purple-700 text-white" : "text-purple-800 hover:bg-purple-50"}`}>EN</button>
      <button type="button" onClick={() => setLanguage("bn")} aria-pressed={language === "bn"} className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${language === "bn" ? "bg-purple-700 text-white" : "text-purple-800 hover:bg-purple-50"}`}>বাংলা</button>
    </div>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-purple-100 bg-white/90 shadow-sm backdrop-blur-md">
      {/* One row on large screens (brand, nav, actions); on tablets the nav drops to a second row. */}
      <div className="mx-auto flex min-h-14 max-w-7xl flex-wrap items-center justify-between gap-x-3 px-4 sm:px-6 lg:px-6 xl:gap-x-4 xl:px-8 lg:h-16 lg:flex-nowrap">
        <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2 py-1.5" aria-label={localize(language, "Go to home", "হোমে ফিরে যান")}>
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-purple-700 to-purple-950 text-white shadow-lg shadow-purple-800/20">
            <Smile size={20} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold tracking-tight text-purple-950 sm:text-base">{clinicName}</span>
            <span className="block text-[11px] font-semibold text-purple-700">{clinicSubtitle}</span>
          </span>
        </Link>

        <nav className="order-3 hidden w-full border-t border-purple-100/80 py-1 md:block lg:order-none lg:w-auto lg:min-w-0 lg:flex-1 lg:border-t-0 lg:py-0" aria-label={localize(language, "Main navigation", "প্রধান নেভিগেশন")}>
          <div className="flex flex-wrap items-center justify-start gap-x-1 gap-y-0.5 text-sm font-medium text-slate-700 lg:flex-nowrap lg:justify-center">
            {navItems.map(({ anchor, label, href }) => (
              <a key={anchor} href={href ?? `#${anchor}`} className="whitespace-nowrap rounded-lg px-2 py-1.5 transition-colors hover:bg-purple-50 hover:text-purple-800 max-xl:px-1.5 lg:text-[13px] 2xl:px-2.5 2xl:text-sm">{label[language]}</a>
            ))}
          </div>
        </nav>

        <div className="flex shrink-0 items-center gap-2 py-1.5">
          {tel && (
            <a href={`tel:${tel}`} aria-label={localize(language, "Call", "কল করুন")} className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 md:inline-flex">
              <Phone size={15} /> <span className="max-2xl:hidden">{localize(language, "Call", "কল করুন")}</span>
            </a>
          )}
          <Link href="/#appointment" className="hidden items-center gap-2 rounded-full bg-purple-700 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-purple-700/25 transition-colors hover:bg-purple-800 md:inline-flex">
            <span className="xl:hidden">{localize(language, "Book", "সিরিয়াল")}</span><span className="max-xl:hidden">{localize(language, "Book an appointment", "সিরিয়াল নিন")}</span> <CalendarDays size={15} className="max-xl:hidden" />
          </Link>
          {languageToggle}
          <Link href="/login" aria-label={localize(language, "Admin login", "অ্যাডমিন লগইন")} className="hidden items-center md:ml-1 lg:ml-2 gap-1.5 rounded-full px-2 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-purple-50 hover:text-purple-800 md:inline-flex">
            <LogIn size={15} /> <span className="hidden">{localize(language, "Admin login", "অ্যাডমিন লগইন")}</span>
          </Link>
          <button type="button" className="grid size-9 place-items-center rounded-full border border-purple-200 bg-white text-purple-800 md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? localize(language, "Close menu", "মেনু বন্ধ করুন") : localize(language, "Open menu", "মেনু খুলুন")} aria-expanded={menuOpen}>
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="border-t border-purple-100 bg-white px-4 py-3 md:hidden" aria-label={localize(language, "Mobile navigation", "মোবাইল নেভিগেশন")}>
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-2">
            {navItems.map(({ anchor, label, href }) => (
              <a key={anchor} href={href ?? `#${anchor}`} onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-purple-50 hover:text-purple-800">{label[language]}</a>
            ))}
            <Link href="/login" onClick={() => setMenuOpen(false)} className="col-span-2 inline-flex items-center justify-center gap-2 rounded-lg bg-purple-50 px-3 py-2.5 text-sm font-semibold text-purple-800 hover:bg-purple-100">
              <LogIn size={16} /> {localize(language, "Admin login", "অ্যাডমিন লগইন")}
            </Link>
            {tel && (
              <a href={`tel:${tel}`} onClick={() => setMenuOpen(false)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">
                <Phone size={16} /> {localize(language, "Call", "কল করুন")}
              </a>
            )}
            <Link href="/#appointment" onClick={() => setMenuOpen(false)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-700 px-3 py-2.5 text-sm font-semibold text-white hover:bg-purple-800">
              {localize(language, "Book", "সিরিয়াল নিন")} <CalendarDays size={16} />
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
