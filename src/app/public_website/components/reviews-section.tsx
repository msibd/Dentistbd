"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { MessageSquareText, Star } from "lucide-react";
import { validatePhone } from "@/lib/contact-rules";
import { localize, usePublicLanguage } from "./public-language";
import type { PublicReview } from "./types";

export default function ReviewsSection({ badge, title, subtitle }: { badge: string; title: string; subtitle?: string }) {
  const { language } = usePublicLanguage();
  const languageRef = useRef(language);
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; phone?: string }>({});
  const [rating, setRating] = useState("5");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    let active = true;
    fetch("/public_website/api/reviews", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as { reviews?: PublicReview[]; error?: string };
        if (!response.ok) throw new Error(result.error ?? localize(languageRef.current, "Could not load reviews.", "রিভিউ লোড করা যায়নি।"));
        return result;
      })
      .then((result) => {
        if (active) setReviews(result.reviews ?? []);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : localize(languageRef.current, "Could not load reviews.", "রিভিউ লোড করা যায়নি।"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    // Same checks the server makes, with messages in the visitor's language.
    const problems: { name?: string; phone?: string } = {};
    if (name.trim().length < 2) problems.name = localize(language, "Enter your name.", "আপনার নাম লিখুন।");
    if (!phone.trim()) problems.phone = localize(language, "Enter your registered mobile number.", "আপনার নিবন্ধিত মোবাইল নম্বর লিখুন।");
    else if (validatePhone(phone, true)) problems.phone = localize(language, "Enter a valid mobile number, for example 01712345678.", "একটি সঠিক মোবাইল নম্বর লিখুন, যেমন 01712345678।");
    setFieldErrors(problems);
    if (problems.name || problems.phone) {
      document.getElementById(problems.name ? "review-name" : "review-phone")?.focus();
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/public_website/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), rating: Number(rating), comment: comment.trim() }),
      });
      const result = await response.json() as { error?: string };
      if (response.status === 403) {
        throw new Error(localize(language, "We could not match this name and mobile number with our patient records. Please enter them as you gave them to the clinic.", "এই নাম ও মোবাইল নম্বর আমাদের রোগীর তালিকায় মেলেনি। ক্লিনিকে যেভাবে দিয়েছেন সেভাবেই লিখুন।"));
      }
      if (response.status === 409) {
        throw new Error(localize(language, "You have already shared a review. Thank you! You can write another once the clinic has handled it.", "আপনি ইতিমধ্যে একটি রিভিউ দিয়েছেন, ধন্যবাদ! ক্লিনিক সেটি দেখার পর আবার লিখতে পারবেন।"));
      }
      if (!response.ok) throw new Error(result.error ?? localize(language, "Could not submit review.", "রিভিউ জমা দেওয়া যায়নি।"));
      setName("");
      setPhone("");
      setFieldErrors({});
      setComment("");
      setRating("5");
      setShowForm(false);
      setNotice(localize(language, "Review submitted. The clinic will review it before publishing.", "রিভিউ জমা হয়েছে; প্রকাশের আগে ক্লিনিক যাচাই করবে।"));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : localize(language, "Could not submit review.", "রিভিউ জমা দেওয়া যায়নি।"));
    } finally {
      setSubmitting(false);
    }
  }

  const average = reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : null;

  return (
    <section id="reviews" className="bg-purple-50/60 py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold tracking-wide text-purple-800">{badge}</span>
          <h2 className="mt-4 text-3xl font-bold text-slate-900 sm:text-4xl"><span className="site-title">{title}</span></h2>
          {subtitle && <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">{subtitle}</p>}
          {average !== null && <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-white px-4 py-2 text-sm font-semibold text-purple-900"><Star size={16} className="fill-amber-400 text-amber-400" /> {average.toLocaleString(language === "bn" ? "bn-BD" : "en-US", { maximumFractionDigits: 1 })}/{localize(language, "5", "৫")} · {reviews.length.toLocaleString(language === "bn" ? "bn-BD" : "en-US")} {localize(language, "reviews", "টি রিভিউ")}</p>}
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500">{localize(language, "Loading reviews…", "রিভিউ লোড হচ্ছে…")}</p>
        ) : reviews.length ? (
          <div className="mb-9 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {reviews.map((review) => (
              <article key={review.id} className="flex flex-col justify-between rounded-3xl border border-purple-100 bg-white p-6 shadow-[0_10px_30px_-5px_rgba(107,33,168,0.08)]">
                <div>
                  <div className="mb-3 flex gap-1" aria-label={`${review.rating} out of 5 stars`}>
                    {Array.from({ length: 5 }, (_, index) => <Star key={index} size={15} className={index < review.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"} />)}
                  </div>
                  <p className="mb-6 text-sm leading-relaxed text-slate-600">“{review.comment}”</p>
                </div>
                <div className="flex items-center gap-3 border-t border-purple-50 pt-4">
                  <span className="grid size-10 place-items-center rounded-full bg-purple-100 text-sm font-bold text-purple-800">{review.name.trim().charAt(0)}</span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{review.name}</h3>
                    <p className="text-xs text-slate-400">{localize(language, "Verified patient review", "প্রকাশিত রোগী-রিভিউ")}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          !error && <p className="mb-8 py-4 text-center text-sm text-slate-500">{localize(language, "No published reviews yet.", "এখনও কোনো প্রকাশিত রিভিউ নেই।")}</p>
        )}

        {error && <p className="mb-5 text-center text-sm text-rose-700" role="alert">{error}</p>}
        {notice && <p className="mb-5 text-center text-sm font-medium text-emerald-700" role="status">{notice}</p>}
        <div className="text-center">
          <button type="button" onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-white px-6 py-3 text-sm font-semibold text-purple-800 shadow-sm transition-colors hover:bg-purple-50">
            <MessageSquareText size={16} /> {localize(language, "Write a review", "আপনার রিভিউ লিখুন")}
          </button>
        </div>

        {showForm && (
          <form onSubmit={submitReview} noValidate className="mx-auto mt-6 grid max-w-xl gap-4 rounded-3xl border border-purple-200 bg-white p-6 shadow-lg" aria-describedby={error ? "review-error" : undefined}>
            <h3 className="text-center text-base font-bold text-slate-900">{localize(language, "Share your experience", "আপনার অভিজ্ঞতা শেয়ার করুন")}</h3>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              {localize(language, "Your name", "আপনার নাম")}
              <input id="review-name" required maxLength={120} value={name} onChange={(event) => { setName(event.target.value); setFieldErrors((current) => ({ ...current, name: undefined })); }} aria-invalid={fieldErrors.name ? true : undefined} className="min-h-11 rounded-xl border border-slate-200 px-3 outline-none focus:border-purple-600" />
              {fieldErrors.name && <span className="text-xs font-semibold text-rose-700" role="alert">{fieldErrors.name}</span>}
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              {localize(language, "Your registered mobile number", "আপনার নিবন্ধিত মোবাইল নম্বর")}
              <input
                id="review-phone"
                required
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                maxLength={30}
                placeholder="01XXXXXXXXX"
                value={phone}
                onChange={(event) => { setPhone(event.target.value); setFieldErrors((current) => ({ ...current, phone: undefined })); }}
                aria-invalid={fieldErrors.phone ? true : undefined}
                aria-describedby={fieldErrors.phone ? "review-phone-help review-phone-error" : "review-phone-help"}
                className="min-h-11 rounded-xl border border-slate-200 px-3 outline-none focus:border-purple-600"
              />
              <span id="review-phone-help" className="text-xs font-normal leading-relaxed text-slate-500">
                {localize(language, "Use the number you gave the clinic. Only patients of the clinic can write a review. We use the number only to check this and never show it on the website.", "ক্লিনিকে যে নম্বর দিয়েছেন সেটি লিখুন। শুধু ক্লিনিকের রোগীরাই রিভিউ লিখতে পারেন। নম্বরটি শুধু যাচাইয়ের জন্য ব্যবহার হয়, ওয়েবসাইটে কখনো দেখানো হয় না।")}
              </span>
              {fieldErrors.phone && <span id="review-phone-error" className="text-xs font-semibold text-rose-700" role="alert">{fieldErrors.phone}</span>}
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              {localize(language, "Rating", "রেটিং")}
              <select value={rating} onChange={(event) => setRating(event.target.value)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-purple-600">
                {[5, 4, 3, 2, 1].map((value) => <option value={value} key={value}>{`${"★".repeat(value)}${"☆".repeat(5 - value)} (${localize(language, String(value), new Intl.NumberFormat("bn-BD").format(value))}/${localize(language, "5", "৫")})`}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              {localize(language, "Your comment", "আপনার মন্তব্য")}
              <textarea required maxLength={2000} rows={4} value={comment} onChange={(event) => setComment(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-purple-600" />
            </label>
            {error && <p id="review-error" className="text-sm text-rose-700" role="alert">{error}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">{localize(language, "Cancel", "বাতিল")}</button>
              <button type="submit" disabled={submitting} className="rounded-xl bg-purple-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-purple-800 disabled:opacity-60">{submitting ? localize(language, "Submitting…", "জমা হচ্ছে…") : localize(language, "Submit", "জমা দিন")}</button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
