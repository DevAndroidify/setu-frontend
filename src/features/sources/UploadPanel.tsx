import { useMutation } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { ApiError } from '../../api/client';
import { Alert, Button } from '../../ui/controls';
import { ProblemMessage } from '../../ui/ProblemMessage';
import { KINDS, MAX_UPLOAD_BYTES, type Source, type SourceFile, uploadFile } from './api';
import { formatBytes } from './format';
import styles from './sources.module.css';

/** The backend's upload answers, in words that say what to do next. */
function uploadMessage(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  if (error.status === 409) return `${error.detail}. The same bytes can only be imported once.`;
  if (error.status === 413) return 'The file is larger than the 50 MB limit.';
  if (error.status === 415 || error.status === 400) return error.detail ?? null;
  return null;
}

export function UploadPanel({
  source,
  onUploaded,
}: {
  source: Source;
  onUploaded: (file: SourceFile) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [tooBig, setTooBig] = useState(false);
  const kind = KINDS[source.kind];

  const upload = useMutation({
    mutationFn: (file: File) => uploadFile(source.id, file, setProgress),
    onSuccess: (file) => {
      setChosen(null);
      if (input.current) input.current.value = '';
      onUploaded(file);
    },
  });

  function choose(file: File | undefined) {
    if (!file) return;
    upload.reset();
    setProgress(0);
    setTooBig(file.size > MAX_UPLOAD_BYTES);
    setChosen(file);
  }

  function drop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    choose(event.dataTransfer.files[0]);
  }

  const friendly = uploadMessage(upload.error);
  return (
    <section className={styles.panel} aria-labelledby="upload-title">
      <h2 id="upload-title">Upload a file</h2>
      <div
        className={dragging ? `${styles.drop} ${styles.dragging}` : styles.drop}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
      >
        <p>
          Drop a {kind.label} here, or{' '}
          <label className={styles.pick}>
            choose one
            <input
              ref={input}
              type="file"
              accept={kind.accept}
              className={styles.hiddenInput}
              onChange={(e) => choose(e.target.files?.[0])}
            />
          </label>
          .
        </p>
        <p className={styles.hint}>{kind.hint} Up to 50 MB.</p>
      </div>

      {chosen && (
        <div className={styles.chosen}>
          <p>
            <strong>{chosen.name}</strong> ({formatBytes(chosen.size)})
          </p>
          {tooBig ? (
            <Alert kind="error">
              <p>The file is larger than the 50 MB limit.</p>
            </Alert>
          ) : (
            <Button onClick={() => upload.mutate(chosen)} disabled={upload.isPending}>
              {upload.isPending ? `Uploading… ${Math.round(progress * 100)}%` : 'Upload'}
            </Button>
          )}
          {upload.isPending && (
            <progress
              className={styles.progress}
              value={progress}
              max={1}
              aria-label="Upload progress"
            />
          )}
        </div>
      )}

      {upload.isError &&
        (friendly ? (
          <Alert kind="error">
            <p>{friendly}</p>
          </Alert>
        ) : (
          <ProblemMessage error={upload.error} title="Upload failed" />
        ))}
    </section>
  );
}
