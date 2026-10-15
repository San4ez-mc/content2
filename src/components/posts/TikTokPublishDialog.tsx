"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Вікно публікації в TikTok за вимогами TikTok до Content Posting API (Direct Post):
// нік акаунта, приватність БЕЗ значення за замовчуванням, коментарі/дует/стіч вимкнені за замовчуванням,
// розкриття комерційного змісту, текст згоди перед кнопкою, попередній перегляд, редагований підпис,
// повідомлення про час обробки та статус після публікації. Службові тексти TikTok — англійською, як у вимогах.

interface Creator {
  nickname?: string;
  username?: string;
  avatarUrl?: string;
  privacyLevelOptions?: string[];
  commentDisabled?: boolean;
  duetDisabled?: boolean;
  stitchDisabled?: boolean;
  maxVideoPostDurationSec?: number;
}

interface Props {
  postId: string;
  videoUrl: string;
  initialTitle: string;
  onClose: () => void;
  onPublished: () => void;
}

const PRIVACY_LABELS: Record<string, string> = {
  PUBLIC_TO_EVERYONE: "Everyone",
  MUTUAL_FOLLOW_FRIENDS: "Friends",
  FOLLOWER_OF_CREATOR: "Followers",
  SELF_ONLY: "Only me",
};

const MUSIC_URL = "https://www.tiktok.com/legal/page/global/music-usage-confirmation/en";
const BRANDED_URL = "https://www.tiktok.com/legal/page/global/bc-policy/en";

type Phase = "idle" | "submitting" | "waiting" | "published" | "failed";

export function TikTokPublishDialog({ postId, videoUrl, initialTitle, onClose, onPublished }: Props) {
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [creator, setCreator] = useState<Creator | null>(null);

  const [title, setTitle] = useState(initialTitle.slice(0, 2200));
  const [privacy, setPrivacy] = useState("");
  const [allowComment, setAllowComment] = useState(false);
  const [allowDuet, setAllowDuet] = useState(false);
  const [allowStitch, setAllowStitch] = useState(false);
  const [disclose, setDisclose] = useState(false);
  const [brandOrganic, setBrandOrganic] = useState(false);
  const [brandContent, setBrandContent] = useState(false);
  const [isAigc, setIsAigc] = useState(true);
  const [videoSec, setVideoSec] = useState<number | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [resultMsg, setResultMsg] = useState("");
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  // 1) інформація про акаунт TikTok (асинхронно через воронку)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const start = await fetch(`/api/posts/${postId}/tiktok-creator`, { method: "POST" });
        const sj = await start.json().catch(() => ({}));
        if (!start.ok || !sj.requestId) throw new Error(sj.error || `Помилка ${start.status}`);
        for (let i = 0; i < 30 && !cancelled; i++) {
          await new Promise((r) => setTimeout(r, 1500));
          const r = await fetch(`/api/posts/${postId}/tiktok-creator?requestId=${encodeURIComponent(sj.requestId)}`);
          const j = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(j.error || `Помилка ${r.status}`);
          if (j.ready) {
            if (!j.ok || !j.creator) throw new Error(j.error || "TikTok не повернув дані акаунта");
            if (!cancelled) { setCreator(j.creator); setLoadState("ready"); }
            return;
          }
        }
        if (!cancelled) throw new Error("TikTok не відповів вчасно. Закрийте вікно й спробуйте ще раз.");
      } catch (e: any) {
        if (!cancelled) { setLoadError(e?.message || "Помилка"); setLoadState("error"); }
      }
    })();
    return () => { cancelled = true; };
  }, [postId]);

  const options = (creator?.privacyLevelOptions || []).filter((o) => o in PRIVACY_LABELS);
  const onlyPrivate = options.length > 0 && options.every((o) => o === "SELF_ONLY");
  const tooLong = !!(creator?.maxVideoPostDurationSec && videoSec && videoSec > creator.maxVideoPostDurationSec);
  const discloseIncomplete = disclose && !brandOrganic && !brandContent;
  // Календар оновлюємо лише при закритті вікна: onPublished закриває модалку поста, а користувач має встигнути побачити результат.
  function handleClose() {
    if (phase === "published") onPublished();
    onClose();
  }

  const canSubmit = loadState === "ready" && !!privacy && !discloseIncomplete && !tooLong && (phase === "idle" || phase === "failed");

  const labelNotice = brandContent
    ? "Your video will be labeled as 'Paid partnership'."
    : brandOrganic
      ? "Your video will be labeled as 'Promotional content'."
      : "";

  function onPrivacyChange(v: string) {
    setPrivacy(v);
    if (v === "SELF_ONLY") setBrandContent(false);
  }

  async function submit(force = false) {
    setPhase("submitting");
    setResultMsg("");
    try {
      const r = await fetch(`/api/posts/${postId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          force,
          tiktok: {
            privacy_level: privacy,
            title,
            allow_comment: allowComment,
            allow_duet: allowDuet,
            allow_stitch: allowStitch,
            disclose,
            brand_organic: disclose && brandOrganic,
            brand_content: disclose && brandContent,
            is_aigc: isAigc,
            consent: true,
          },
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 409 && j.code === "already_published") {
        if (confirm("This video has already been published. Publish again?")) return submit(true);
        setPhase("idle");
        return;
      }
      if (!r.ok || !j.ok) { setPhase("failed"); setResultMsg(j.error || `Помилка ${r.status}`); return; }
      setPhase("waiting");
      pollStatus();
    } catch (e: any) {
      setPhase("failed");
      setResultMsg(e?.message || "Помилка мережі");
    }
  }

  // 2) статус публікації (воронка повертає результат у content2)
  async function pollStatus() {
    for (let i = 0; i < 75 && alive.current; i++) {
      await new Promise((r) => setTimeout(r, 4000));
      try {
        const r = await fetch(`/api/posts/${postId}/publish-status`);
        const j = await r.json().catch(() => ({}));
        if (j.status === "published") { if (alive.current) setPhase("published"); return; }
        if (j.status === "failed") { if (alive.current) { setPhase("failed"); setResultMsg(j.error || "Publishing failed"); } return; }
      } catch { /* ще раз */ }
    }
    if (alive.current) { setPhase("failed"); setResultMsg("Status check timed out. The video may still appear on your profile in a few minutes."); }
  }

  return (
    <div className="modal-backdrop z-[60]" onClick={phase === "submitting" ? undefined : handleClose}>
      <div
        className="bg-canvas-subtle border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <h3 className="text-sm font-semibold text-fg">🎵 Post to TikTok</h3>
          <button onClick={handleClose} className="text-fg-subtle hover:text-fg text-lg" aria-label="Close">×</button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {loadState === "loading" && <p className="text-xs text-fg-muted">Loading your TikTok account… / Завантажую дані акаунта TikTok…</p>}
          {loadState === "error" && <div className="text-xs text-danger bg-danger/10 rounded-lg p-3">⚠️ {loadError}</div>}

          {loadState === "ready" && creator && (
            <>
              <div className="flex items-center gap-3">
                {creator.avatarUrl && <img src={creator.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />}
                <div className="min-w-0">
                  <p className="text-[11px] text-fg-subtle">Posting to</p>
                  <p className="text-sm font-medium text-fg truncate">
                    {creator.nickname || creator.username || "TikTok account"}
                    {creator.username && creator.nickname && <span className="text-fg-subtle font-normal"> @{creator.username}</span>}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-fg-muted mb-1.5">Preview</p>
                <video
                  src={videoUrl}
                  controls
                  playsInline
                  className="w-full max-h-72 rounded-lg bg-black"
                  onLoadedMetadata={(e) => setVideoSec(Math.round((e.target as HTMLVideoElement).duration))}
                />
                {tooLong && (
                  <p className="text-[11px] text-danger mt-1">
                    Video is {videoSec}s; your account allows at most {creator.maxVideoPostDurationSec}s.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1.5">Title</label>
                <textarea
                  className="input min-h-[72px] text-xs"
                  value={title}
                  maxLength={2200}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Add a title, hashtags and mentions"
                />
                <p className="text-[10px] text-fg-subtle text-right">{title.length}/2200</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1.5">Who can view this video</label>
                <select className="input text-xs" value={privacy} onChange={(e) => onPrivacyChange(e.target.value)}>
                  <option value="" disabled>Select privacy…</option>
                  {options.map((o) => (
                    <option key={o} value={o} disabled={o === "SELF_ONLY" && disclose && brandContent}
                      title={o === "SELF_ONLY" && disclose && brandContent ? "Branded content visibility cannot be set to private." : undefined}>
                      {PRIVACY_LABELS[o]}
                    </option>
                  ))}
                </select>
                {onlyPrivate && (
                  <p className="text-[10px] text-fg-subtle mt-1">Until the app passes TikTok's audit, only “Only me” is available.</p>
                )}
              </div>

              <div>
                <p className="text-xs font-medium text-fg-muted mb-1.5">Allow users to</p>
                <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                  {[
                    { label: "Comment", v: allowComment, set: setAllowComment, off: creator.commentDisabled },
                    { label: "Duet", v: allowDuet, set: setAllowDuet, off: creator.duetDisabled },
                    { label: "Stitch", v: allowStitch, set: setAllowStitch, off: creator.stitchDisabled },
                  ].map((t) => (
                    <label key={t.label} className={cn("flex items-center gap-1.5 text-xs", t.off ? "text-fg-subtle opacity-60" : "text-fg cursor-pointer")}
                      title={t.off ? "Turned off in your TikTok settings" : undefined}>
                      <input type="checkbox" checked={t.v && !t.off} disabled={!!t.off} onChange={(e) => t.set(e.target.checked)} />
                      {t.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="border border-border rounded-lg p-3 space-y-2">
                <label className="flex items-center justify-between text-xs text-fg cursor-pointer">
                  <span>
                    <span className="font-medium">Disclose video content</span>
                    <span className="block text-[10px] text-fg-subtle">Turn on to disclose that this video promotes goods or services.</span>
                  </span>
                  <input type="checkbox" checked={disclose} onChange={(e) => { setDisclose(e.target.checked); if (!e.target.checked) { setBrandOrganic(false); setBrandContent(false); } }} />
                </label>
                {disclose && (
                  <div className="pl-1 space-y-1.5">
                    <label className="flex items-center gap-2 text-xs text-fg cursor-pointer">
                      <input type="checkbox" checked={brandOrganic} onChange={(e) => setBrandOrganic(e.target.checked)} />
                      <span>Your brand <span className="text-fg-subtle">— you are promoting yourself or your own business</span></span>
                    </label>
                    <label
                      className={cn("flex items-center gap-2 text-xs", privacy === "SELF_ONLY" ? "text-fg-subtle opacity-60" : "text-fg cursor-pointer")}
                      title={privacy === "SELF_ONLY" ? "Branded content visibility cannot be set to private." : undefined}
                    >
                      <input type="checkbox" checked={brandContent} disabled={privacy === "SELF_ONLY"}
                        onChange={(e) => { setBrandContent(e.target.checked); }} />
                      <span>Branded content <span className="text-fg-subtle">— you are promoting another brand or a third party</span></span>
                    </label>
                    {labelNotice && <p className="text-[11px] text-fg-muted">{labelNotice}</p>}
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 text-xs text-fg cursor-pointer">
                <input type="checkbox" checked={isAigc} onChange={(e) => setIsAigc(e.target.checked)} />
                <span>AI-generated content <span className="text-fg-subtle">— label this video as AI-generated</span></span>
              </label>

              <p className="text-[11px] text-fg-muted leading-relaxed">
                {brandContent ? (
                  <>By posting, you agree to TikTok's <a className="underline" href={BRANDED_URL} target="_blank" rel="noreferrer">Branded Content Policy</a> and <a className="underline" href={MUSIC_URL} target="_blank" rel="noreferrer">Music Usage Confirmation</a>.</>
                ) : (
                  <>By posting, you agree to TikTok's <a className="underline" href={MUSIC_URL} target="_blank" rel="noreferrer">Music Usage Confirmation</a>.</>
                )}
              </p>

              <p className="text-[11px] text-fg-subtle">
                After publishing, it may take a few minutes for your video to appear on your TikTok profile.
              </p>
            </>
          )}

          {phase === "waiting" && <div className="text-xs text-fg-muted bg-border/30 rounded-lg p-3">⏳ Uploading to TikTok… this may take a few minutes. Do not close this window.</div>}
          {phase === "published" && <div className="text-xs text-success bg-success/10 rounded-lg p-3">✅ Sent to TikTok. It may take a few minutes to appear on your profile.</div>}
          {phase === "failed" && <div className="text-xs text-danger bg-danger/10 rounded-lg p-3">⚠️ {resultMsg}</div>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border shrink-0">
          <button onClick={handleClose} disabled={phase === "submitting"} className="btn-ghost text-xs px-3 py-1.5">
            {phase === "published" ? "Close" : "Cancel"}
          </button>
          {phase !== "published" && (
            <button
              onClick={() => submit(false)}
              disabled={!canSubmit}
              title={discloseIncomplete ? "You need to indicate if your content promotes yourself, a third party, or both." : !privacy ? "Select who can view this video" : undefined}
              className="btn-primary text-xs px-4 py-1.5 disabled:opacity-50"
            >
              {phase === "submitting" ? "Sending…" : "Publish"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
