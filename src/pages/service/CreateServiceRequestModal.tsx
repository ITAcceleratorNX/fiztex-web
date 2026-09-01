import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { AlertTriangle, ArrowLeft, Brush, Plus, Wrench, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, TextArea, TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/Switch';
import { useCreateServiceRequest } from '@/hooks/queries';
import { cx } from '@/lib/format';
import {
  FIELD_LIMITS,
  MAX_PHOTOS,
  MAX_PHOTO_BYTES,
  PHOTO_EXTENSIONS,
  type ServiceRequest,
  type ServiceType,
} from '@/lib/serviceRequestsApi';
import { actionErrorText, fieldErrors, floorLabel } from '@/lib/serviceRequestsModel';

const TYPES: { value: ServiceType; label: string; icon: typeof Brush }[] = [
  { value: 'CLEANING', label: 'Клининг', icon: Brush },
  { value: 'TECHNICIAN', label: 'Техническая', icon: Wrench },
];

/**
 * Создание заявки в два шага (ТЗ SERVICE-FE-001 §4, Figma «Создать заявку — Шаг 1 / Шаг 2»).
 *
 * Шаги не косметика: на первом человек отвечает, что и где, на втором — описывает и
 * прикладывает снимки. Разделение позволяет спросить обязательное местонахождение до
 * того, как он напишет тысячу символов описания, и напомнить ответ первого шага строкой
 * подзаголовка.
 *
 * «Создать и взять в работу» здесь нет, хотя в макете кнопка стоит рядом: §4 и §12
 * исключают её для Admin и Teacher — брать заявку в работу они не могут.
 */
export function CreateServiceRequestModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (created: ServiceRequest) => void;
}) {
  const create = useCreateServiceRequest();

  const [step, setStep] = useState<1 | 2>(1);
  const [serviceType, setServiceType] = useState<ServiceType | null>(null);
  const [buildingText, setBuildingText] = useState('');
  const [floorText, setFloorText] = useState('');
  const [locationText, setLocationText] = useState('');
  const [emergency, setEmergency] = useState(false);
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  // Подсветка появляется после того, как поле покинули, а не с первого символа: красное
  // поле, которого ещё не касались, — упрёк за незаполненную форму.
  const [blurred, setBlurred] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) return;
    setStep(1);
    setServiceType(null);
    setBuildingText('');
    setFloorText('');
    setLocationText('');
    setEmergency(false);
    setDescription('');
    setPhotos([]);
    setPhotoError(null);
    setBlurred({});
    create.reset();
    // `create` — объект мутации, он новый на каждый рендер; сбрасываем по факту закрытия.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const serverFields = fieldErrors(create.error);
  const stepOneValid = Boolean(
    serviceType && buildingText.trim() && floorText.trim() && locationText.trim(),
  );
  const stepTwoValid = description.trim().length > 0;

  const summary = [
    TYPES.find((type) => type.value === serviceType)?.label,
    buildingText.trim(),
    floorLabel(floorText),
    locationText.trim(),
  ]
    .filter(Boolean)
    .join(' · ');

  function errorFor(field: string, value: string): string | undefined {
    if (serverFields[field]) return serverFields[field];
    return blurred[field] && !value.trim() ? 'Заполните это поле' : undefined;
  }

  function markBlurred(field: string) {
    return () => setBlurred((prev) => ({ ...prev, [field]: true }));
  }

  function addPhotos(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    // Значение сбрасывается, иначе повторный выбор того же файла не вызовет change.
    event.target.value = '';
    setPhotoError(null);

    const room = MAX_PHOTOS - photos.length;
    const accepted: File[] = [];
    for (const file of picked.slice(0, room)) {
      if (!PHOTO_EXTENSIONS.test(file.name)) {
        setPhotoError(`Файл ${file.name} не в поддерживаемом формате: нужны JPG, PNG или HEIC.`);
        break;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        setPhotoError(`Фотография ${file.name} больше 10 МБ — выберите файл поменьше.`);
        break;
      }
      accepted.push(file);
    }
    if (picked.length > room) {
      setPhotoError(`Можно приложить не больше ${MAX_PHOTOS} фотографий.`);
    }
    if (accepted.length > 0) setPhotos((prev) => [...prev, ...accepted]);
  }

  async function submit() {
    if (!serviceType || !stepTwoValid) return;
    const created = await create.mutateAsync({
      serviceType,
      emergency,
      buildingText: buildingText.trim(),
      floorText: floorText.trim(),
      locationText: locationText.trim(),
      description: description.trim(),
      photos,
    });
    onCreated(created);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Создать заявку"
      subtitle={
        step === 1 ? 'Выберите тип и укажите местонахождение' : 'Опишите проблему и приложите фото'
      }
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button variant="secondary" onClick={onClose} disabled={create.isPending}>
            Отмена
          </Button>
          {step === 1 ? (
            <Button onClick={() => setStep(2)} disabled={!stepOneValid}>
              Далее
            </Button>
          ) : (
            <Button onClick={() => void submit()} loading={create.isPending} disabled={!stepTwoValid}>
              Создать заявку
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          {step === 2 ? (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-1.5 text-13 font-semibold text-link transition hover:underline"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Назад
            </button>
          ) : (
            <span />
          )}
          <span className="flex items-center gap-2 text-11 text-subtle">
            <StepDots step={step} />
            Шаг {step} из 2
          </span>
        </div>

        {/* Отказ, не привязанный к полю: сеть, конфликт, что-то ещё. Полевые ошибки
            показывают сами поля — дублировать их плашкой значило бы сказать дважды. */}
        {create.isError && Object.keys(serverFields).length === 0 && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border-l-4 border-red-500 bg-red-50 px-3 py-2.5 text-13 text-red-600"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {actionErrorText(create.error)}
          </p>
        )}

        {step === 1 ? (
          <>
            <Field label="Тип заявки" required error={serverFields.serviceType}>
              <div className="mt-1 grid grid-cols-2 gap-3">
                {TYPES.map((type) => {
                  const Icon = type.icon;
                  const selected = type.value === serviceType;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setServiceType(type.value)}
                      className={cx(
                        'flex items-center gap-2.5 rounded-xl border px-4 py-3 text-left text-13 transition',
                        selected
                          ? 'border-brand-500 bg-brand-50 font-semibold text-brand-700'
                          : 'border-line bg-white text-ink hover:border-slate-300',
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden />
                      {type.label}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Корпус" required error={errorFor('buildingText', buildingText)}>
              <TextInput
                value={buildingText}
                onChange={(e) => setBuildingText(e.target.value)}
                onBlur={markBlurred('buildingText')}
                placeholder="Например: Корпус А"
                maxLength={FIELD_LIMITS.buildingText}
                error={Boolean(errorFor('buildingText', buildingText))}
              />
            </Field>

            <Field label="Этаж" required error={errorFor('floorText', floorText)}>
              <TextInput
                value={floorText}
                onChange={(e) => setFloorText(e.target.value)}
                onBlur={markBlurred('floorText')}
                placeholder="Например: 3"
                maxLength={FIELD_LIMITS.floorText}
                error={Boolean(errorFor('floorText', floorText))}
              />
            </Field>

            <Field label="Кабинет / зона" required error={errorFor('locationText', locationText)}>
              <TextInput
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                onBlur={markBlurred('locationText')}
                placeholder="Например: Каб. 204 или Спортзал"
                maxLength={FIELD_LIMITS.locationText}
                error={Boolean(errorFor('locationText', locationText))}
              />
            </Field>

            <div className="flex items-center justify-between gap-4 border-t border-line pt-4">
              <div>
                <p className="text-13 font-semibold text-ink">Экстренная заявка</p>
                <p className="text-11 text-subtle">Отметьте, если требуется срочное решение</p>
              </div>
              <Switch checked={emergency} onChange={setEmergency} />
            </div>
          </>
        ) : (
          <>
            {/* Сводка первого шага: что именно описывают, видно, не возвращаясь назад. */}
            <p className="rounded-lg bg-neutral-bg px-3 py-2 text-13 text-ink">{summary}</p>

            <Field
              label="Описание"
              required
              error={errorFor('description', description)}
              hint={`${description.length} / ${FIELD_LIMITS.description}`}
            >
              <TextArea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={markBlurred('description')}
                placeholder="Опишите проблему подробнее…"
                maxLength={FIELD_LIMITS.description}
                rows={5}
                error={Boolean(errorFor('description', description))}
              />
            </Field>

            <PhotoPicker
              photos={photos}
              error={photoError ?? serverFields.photos}
              onAdd={addPhotos}
              onRemove={(index) => setPhotos((prev) => prev.filter((_, i) => i !== index))}
            />
          </>
        )}
      </div>
    </Modal>
  );
}

function StepDots({ step }: { step: 1 | 2 }) {
  return (
    <span className="flex items-center gap-1" aria-hidden>
      {[1, 2].map((n) => (
        <span
          key={n}
          className={cx('size-2 rounded-full', n === step ? 'bg-link' : 'bg-slate-300')}
        />
      ))}
    </span>
  );
}

/** «Фото (до 3)»: пунктирная плитка добавления и превью с крестиком (§4, Figma «Шаг 2»). */
function PhotoPicker({
  photos,
  error,
  onAdd,
  onRemove,
}: {
  photos: File[];
  error?: string | null;
  onAdd: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: (index: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <p className="label-base">Фото (до {MAX_PHOTOS})</p>
      <div className="mt-1 flex flex-wrap items-start gap-3">
        {photos.length < MAX_PHOTOS && (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex size-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 text-13 text-subtle transition hover:border-brand-500 hover:text-brand-700"
            >
              <Plus className="size-4" aria-hidden />
              Фото
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.heic,.heif,image/*"
              multiple
              onChange={onAdd}
              className="hidden"
            />
          </>
        )}

        {photos.map((file, index) => (
          <PendingPhoto key={`${file.name}-${index}`} file={file} onRemove={() => onRemove(index)} />
        ))}
      </div>

      {error ? (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      ) : (
        <p className="mt-1 text-xs text-slate-400">JPG, PNG, HEIC · до 10 МБ</p>
      )}
    </div>
  );
}

/** Ещё не отправленное фото: предпросмотр из локального файла и удаление до отправки. */
function PendingPhoto({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return (
    <span className="relative block size-24 overflow-hidden rounded-lg bg-neutral-bg">
      {url && <img src={url} alt={file.name} className="size-full object-cover" />}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Убрать фото ${file.name}`}
        className="absolute right-1 top-1 rounded-full bg-red-500 p-0.5 text-white transition hover:bg-red-600"
      >
        <X className="size-3" aria-hidden />
      </button>
    </span>
  );
}
