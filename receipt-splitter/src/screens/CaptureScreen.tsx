import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Camera, KeyRound, Loader2, PencilLine, ScanLine } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { useUi } from '../state/uiContext';
import { parseReceipt, type ParseFailure } from '../lib/receiptParser';
import type { ScreenProps } from './types';
import type { StringKey } from '../strings';

interface CaptureScreenProps extends ScreenProps {
  accessCode: string;
  onManualInstead: () => void;
  onParsed: () => void;
  onNeedCode: () => void;
}

const FAILURE_MESSAGES: Record<ParseFailure, StringKey> = {
  no_code: 'captureNeedCode',
  bad_code: 'parseBadCode',
  rate_limited: 'parseRateLimited',
  too_large: 'parseTooLarge',
  unreadable: 'parseFailedBody',
  offline: 'parseOffline',
  server: 'parseServerDown',
  unknown: 'errorGeneric',
};

/**
 * Photograph a receipt and hand the result to the review screen.
 *
 * Capture is a plain file input with `capture="environment"`, which opens the
 * camera on a phone and the gallery on a desktop through one control. This
 * deliberately avoids `getUserMedia`: a live video stream would mean permission
 * prompts, a preview surface and orientation handling, in exchange for a photo
 * no better than the one the camera app already takes.
 *
 * Every failure lands on the same screen with an explanation and a working way
 * forward — manual entry — because a bill still has to get split.
 */
export function CaptureScreen({
  dispatch,
  onBack,
  onSettings,
  accessCode,
  onManualInstead,
  onParsed,
  onNeedCode,
}: CaptureScreenProps) {
  const { t } = useUi();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ParseFailure | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Object URLs leak until revoked, and a user retaking photos can create a
  // lot of them.
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFailure(null);
    setBusy(true);
    try {
      const result = await parseReceipt(file, accessCode);
      if (!result.ok) {
        setFailure(result.reason);
        return;
      }
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return result.preview.previewUrl;
      });
      dispatch({ type: 'replace', bill: result.bill });
      onParsed();
    } finally {
      setBusy(false);
      // Clear the input so picking the same file twice still fires onChange.
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const noCode = accessCode.trim() === '';

  return (
    <AppShell
      title={t('captureTitle')}
      subtitle={t('captureSubtitle')}
      onBack={onBack}
      backLabel={t('back')}
      onSettings={onSettings}
      settingsLabel={t('settings')}
      footer={
        <button type="button" className="btn-secondary w-full" onClick={onManualInstead}>
          <PencilLine size={18} aria-hidden />
          {t('captureManualInstead')}
        </button>
      }
    >
      <div className="space-y-4">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />

        {busy ? (
          <div className="card flex flex-col items-center gap-3 px-4 py-12 text-center">
            <Loader2 size={32} className="animate-spin text-accent-600" aria-hidden />
            <p className="font-semibold text-slate-700">{t('captureReading')}</p>
            <p className="text-sm text-slate-500">{t('captureReadingHint')}</p>
          </div>
        ) : noCode ? (
          <div className="card space-y-3 p-5 text-center">
            <KeyRound size={28} className="mx-auto text-accent-600" aria-hidden />
            <p className="font-semibold text-slate-700">{t('captureNeedCode')}</p>
            <p className="text-sm text-slate-500">{t('settingsAccessCodeHint')}</p>
            <button type="button" className="btn-primary w-full" onClick={onNeedCode}>
              {t('captureCodeCta')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="card flex w-full flex-col items-center gap-3 border-2 border-dashed border-slate-200 px-4 py-12 text-center transition active:scale-[0.99]"
          >
            <Camera size={36} className="text-accent-600" aria-hidden />
            <span className="font-semibold text-slate-700">{t('captureTake')}</span>
            <span className="flex items-center gap-1.5 text-sm text-slate-500">
              <ScanLine size={15} aria-hidden />
              {t('parseCheckAfter')}
            </span>
          </button>
        )}

        {failure && !busy && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <p className="flex items-center gap-2 font-semibold text-amber-900">
              <AlertTriangle size={18} className="shrink-0" aria-hidden />
              {t('parseFailedTitle')}
            </p>
            <p className="mt-1.5 text-sm text-amber-900/90">{t(FAILURE_MESSAGES[failure])}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {failure === 'bad_code' || failure === 'no_code' ? (
                <button type="button" className="btn-primary flex-1" onClick={onNeedCode}>
                  {t('captureCodeCta')}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-secondary flex-1"
                  onClick={() => inputRef.current?.click()}
                >
                  {t('captureRetake')}
                </button>
              )}
              <button type="button" className="btn-secondary flex-1" onClick={onManualInstead}>
                {t('captureManualInstead')}
              </button>
            </div>
          </div>
        )}

        {preview && !busy && (
          <img
            src={preview}
            alt=""
            className="max-h-72 w-full rounded-2xl object-contain shadow-[var(--shadow-card)]"
          />
        )}
      </div>
    </AppShell>
  );
}
