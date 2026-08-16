/**
 * Every user-facing string in the app, in both locales.
 *
 * Two languages, no i18n library: `en` is typed against `es`, so adding a
 * Spanish key without its English twin is a compile error. Spanish is the
 * default; the toggle lives in settings and persists per device.
 */

export type Lang = 'es' | 'en';

const es = {
  appName: 'Dividir la cuenta',

  // Navigation and shared controls
  back: 'Atrás',
  next: 'Siguiente',
  done: 'Listo',
  cancel: 'Cancelar',
  delete: 'Eliminar',
  add: 'Añadir',
  edit: 'Editar',
  close: 'Cerrar',
  settings: 'Ajustes',
  people: 'Personas',
  items: 'Artículos',
  assign: 'Asignar',
  totals: 'Totales',

  // Start screen
  startTitle: 'Dividir la cuenta',
  startSubtitle: 'Reparte la cuenta del restaurante entre amigos, al céntimo.',
  newBillPhoto: 'Hacer foto del ticket',
  newBillManual: 'Escribir la cuenta a mano',
  resumeBill: 'Seguir con la cuenta actual',
  historyTitle: 'Cuentas anteriores',
  historyEmpty: 'Todavía no hay cuentas guardadas.',
  historyOpen: 'Ver',
  historyDelete: 'Eliminar cuenta',
  historyDeleteConfirm: '¿Eliminar esta cuenta del historial?',
  unnamedMerchant: 'Sin nombre',

  // People screen
  peopleTitle: '¿Quién come?',
  peopleSubtitle: 'Añade a todos los que van a pagar algo.',
  personNamePlaceholder: 'Nombre',
  peopleEmpty: 'Añade al menos una persona para continuar.',
  peopleSuggestions: 'Habituales',
  peopleRemove: 'Quitar',
  peopleDuplicate: 'Ese nombre ya está en la cuenta.',
  sharesLabel: 'Cubiertos',
  sharesHint: 'Cuántos cubiertos paga esta persona. Afecta al cubierto, no a los platos.',

  // Items screen
  itemsTitle: 'La cuenta',
  itemsSubtitle: 'Revisa cada línea. Todo se puede corregir.',
  itemsEmpty: 'Añade la primera línea de la cuenta.',
  itemAdd: 'Añadir línea',
  itemName: 'Concepto',
  itemNamePlaceholder: 'Ej. Spritz Aperol',
  itemQuantity: 'Cant.',
  itemUnitPrice: 'Precio unidad',
  itemLineTotal: 'Importe',
  itemRemove: 'Eliminar línea',
  merchantLabel: 'Restaurante',
  merchantPlaceholder: 'Nombre del sitio',
  dateLabel: 'Fecha',
  currencyLabel: 'Moneda',
  statedTotalLabel: 'Total del ticket',
  statedTotalHint: 'El total impreso, para comprobar que todo cuadra.',

  // Extras
  extrasTitle: 'Extras',
  extraTax: 'IVA / impuestos',
  extraTip: 'Propina',
  extraService: 'Servicio',
  extraCover: 'Cubierto',
  extraAdd: 'Añadir extra',
  extraAddTip: 'Añadir propina',
  extraTipHint: 'Propina que no viene en el ticket. Se reparte, pero no cuenta para el cuadre.',
  extraOnReceipt: 'En el ticket',
  extraOffReceipt: 'Añadido',
  splitProrated: 'Proporcional',
  splitPerHead: 'Por persona',
  splitProratedHint: 'Según lo que ha consumido cada uno.',
  splitPerHeadHint: 'A partes iguales, por cubiertos.',

  // Reconciliation
  reconcileOk: 'Todo cuadra con el total del ticket.',
  reconcileOffOver: 'Las líneas suman {delta} más que el total del ticket.',
  reconcileOffUnder: 'Las líneas suman {delta} menos que el total del ticket.',
  reconcileNoTotal: 'Sin total del ticket: no se puede comprobar el cuadre.',
  reconcileLines: 'Líneas',
  reconcileComputed: 'Suma',

  // Assign screen
  assignTitle: 'Quién se lleva qué',
  assignSubtitle: 'Toca a cada persona en la línea que ha consumido.',
  assignEveryone: 'Todos',
  assignClearEveryone: 'Quitar a todos',
  assignEach: '{amount} cada uno',
  assignNobody: 'Nadie asignado',
  assignUnitsOf: '{assigned} de {quantity}',
  assignWeightUp: 'Más parte',
  assignWeightDown: 'Menos parte',
  assignNeedPeople: 'Primero añade personas.',
  assignNeedItems: 'Primero añade líneas a la cuenta.',
  unassignedLabel: 'Sin asignar',
  allAssigned: 'Todo asignado',
  blockedTitle: 'Hay {count} línea sin asignar',
  blockedTitlePlural: 'Hay {count} líneas sin asignar',
  blockedBody: 'Si sigues, ese importe no lo paga nadie. Asígnalo o elimina la línea.',
  blockedGoFix: 'Ver líneas sin asignar',
  perPersonPanel: 'Por persona',

  // Totals screen
  totalsTitle: 'Cada uno paga',
  totalsItems: 'Consumo',
  totalsExtras: 'Extras',
  totalsTotal: 'Total',
  totalsCopy: 'Copiar para el chat',
  totalsCopied: 'Copiado',
  totalsCopyFailed: 'No se ha podido copiar. Mantén pulsado el texto para copiarlo a mano.',
  totalsBillTotal: 'Total de la cuenta',
  totalsCheck: 'La suma de todos cuadra con la cuenta.',
  totalsNobody: 'Añade personas para ver los totales.',

  // Settings
  settingsTitle: 'Ajustes',
  settingsLanguage: 'Idioma',
  settingsLanguageEs: 'Español',
  settingsLanguageEn: 'English',
  settingsAccessCode: 'Código de acceso',
  settingsAccessCodeHint:
    'Necesario solo para leer tickets con la cámara. Te lo pasa quien te ha dado la app.',
  settingsAccessCodePlaceholder: 'Código',
  settingsSave: 'Guardar',
  settingsSaved: 'Guardado',
  settingsRosterTitle: 'Nombres guardados',
  settingsRosterHint: 'Se sugieren al crear una cuenta nueva.',
  settingsRosterEmpty: 'Aún no hay nombres guardados.',
  settingsClearRoster: 'Borrar nombres',
  settingsAbout: 'Todo se guarda solo en este teléfono. No hay cuentas ni servidor.',

  // Capture and parsing
  captureTitle: 'Foto del ticket',
  captureSubtitle: 'Haz una foto del ticket completo, bien iluminado y plano.',
  captureTake: 'Hacer foto o elegir imagen',
  captureRetake: 'Otra foto',
  captureRead: 'Leer ticket',
  captureReading: 'Leyendo el ticket…',
  captureReadingHint: 'Suele tardar unos segundos.',
  captureManualInstead: 'Escribirla a mano',
  captureNeedCode: 'Introduce el código de acceso para leer tickets.',
  captureCodeCta: 'Introducir código',
  parseFailedTitle: 'No se ha podido leer el ticket',
  parseFailedBody: 'Puedes intentarlo con otra foto o escribir la cuenta a mano.',
  parseBadCode: 'El código de acceso no es correcto. Revísalo en ajustes.',
  parseRateLimited: 'Se ha alcanzado el límite de tickets por hora. Prueba más tarde.',
  parseTooLarge: 'La imagen es demasiado grande, incluso después de reducirla.',
  parseOffline: 'Sin conexión. La lectura del ticket necesita internet.',
  parseServerDown: 'El servicio de lectura no responde ahora mismo.',
  parseCheckAfter: 'Revisa siempre las líneas: los tickets térmicos se leen mal a menudo.',

  // Errors
  errorGeneric: 'Algo ha ido mal.',
  discardBill: 'Descartar esta cuenta',
  discardBillConfirm: '¿Descartar la cuenta actual? Se perderán los cambios.',
} as const;

const en: Record<keyof typeof es, string> = {
  appName: 'Split the bill',

  back: 'Back',
  next: 'Next',
  done: 'Done',
  cancel: 'Cancel',
  delete: 'Delete',
  add: 'Add',
  edit: 'Edit',
  close: 'Close',
  settings: 'Settings',
  people: 'People',
  items: 'Items',
  assign: 'Assign',
  totals: 'Totals',

  startTitle: 'Split the bill',
  startSubtitle: 'Share a restaurant bill with friends, down to the cent.',
  newBillPhoto: 'Photograph the receipt',
  newBillManual: 'Enter the bill by hand',
  resumeBill: 'Continue current bill',
  historyTitle: 'Past bills',
  historyEmpty: 'No saved bills yet.',
  historyOpen: 'Open',
  historyDelete: 'Delete bill',
  historyDeleteConfirm: 'Delete this bill from history?',
  unnamedMerchant: 'Untitled',

  peopleTitle: "Who's eating?",
  peopleSubtitle: 'Add everyone who is paying for something.',
  personNamePlaceholder: 'Name',
  peopleEmpty: 'Add at least one person to continue.',
  peopleSuggestions: 'Regulars',
  peopleRemove: 'Remove',
  peopleDuplicate: 'That name is already on the bill.',
  sharesLabel: 'Covers',
  sharesHint: 'How many covers this person pays for. Affects the cover charge, not the food.',

  itemsTitle: 'The bill',
  itemsSubtitle: 'Check every line. Everything is editable.',
  itemsEmpty: 'Add the first line of the bill.',
  itemAdd: 'Add line',
  itemName: 'Item',
  itemNamePlaceholder: 'e.g. Aperol Spritz',
  itemQuantity: 'Qty',
  itemUnitPrice: 'Unit price',
  itemLineTotal: 'Amount',
  itemRemove: 'Delete line',
  merchantLabel: 'Restaurant',
  merchantPlaceholder: 'Name of the place',
  dateLabel: 'Date',
  currencyLabel: 'Currency',
  statedTotalLabel: 'Receipt total',
  statedTotalHint: 'The printed total, so we can check everything adds up.',

  extrasTitle: 'Extras',
  extraTax: 'Tax / VAT',
  extraTip: 'Tip',
  extraService: 'Service',
  extraCover: 'Cover charge',
  extraAdd: 'Add extra',
  extraAddTip: 'Add a tip',
  extraTipHint: "A tip that isn't printed on the receipt. It gets shared, but isn't reconciled.",
  extraOnReceipt: 'On receipt',
  extraOffReceipt: 'Added',
  splitProrated: 'Proportional',
  splitPerHead: 'Per person',
  splitProratedHint: 'By what each person consumed.',
  splitPerHeadHint: 'Equally, by covers.',

  reconcileOk: 'Everything matches the receipt total.',
  reconcileOffOver: 'The lines add up to {delta} more than the receipt total.',
  reconcileOffUnder: 'The lines add up to {delta} less than the receipt total.',
  reconcileNoTotal: "No receipt total, so there's nothing to check against.",
  reconcileLines: 'Lines',
  reconcileComputed: 'Sum',

  assignTitle: 'Who had what',
  assignSubtitle: 'Tap each person on the line they had.',
  assignEveryone: 'Everyone',
  assignClearEveryone: 'Clear everyone',
  assignEach: '{amount} each',
  assignNobody: 'Nobody assigned',
  assignUnitsOf: '{assigned} of {quantity}',
  assignWeightUp: 'Bigger share',
  assignWeightDown: 'Smaller share',
  assignNeedPeople: 'Add people first.',
  assignNeedItems: 'Add lines to the bill first.',
  unassignedLabel: 'Unassigned',
  allAssigned: 'All assigned',
  blockedTitle: '{count} line has nobody on it',
  blockedTitlePlural: '{count} lines have nobody on them',
  blockedBody: "Carry on and nobody pays that amount. Assign it, or delete the line.",
  blockedGoFix: 'Show unassigned lines',
  perPersonPanel: 'Per person',

  totalsTitle: 'Each person pays',
  totalsItems: 'Food and drink',
  totalsExtras: 'Extras',
  totalsTotal: 'Total',
  totalsCopy: 'Copy for the group chat',
  totalsCopied: 'Copied',
  totalsCopyFailed: "Couldn't copy. Press and hold the text to copy it by hand.",
  totalsBillTotal: 'Bill total',
  totalsCheck: 'Everyone together adds up to the bill exactly.',
  totalsNobody: 'Add people to see totals.',

  settingsTitle: 'Settings',
  settingsLanguage: 'Language',
  settingsLanguageEs: 'Español',
  settingsLanguageEn: 'English',
  settingsAccessCode: 'Access code',
  settingsAccessCodeHint:
    'Only needed to read receipts with the camera. Whoever gave you the app has it.',
  settingsAccessCodePlaceholder: 'Code',
  settingsSave: 'Save',
  settingsSaved: 'Saved',
  settingsRosterTitle: 'Saved names',
  settingsRosterHint: 'Suggested when you start a new bill.',
  settingsRosterEmpty: 'No saved names yet.',
  settingsClearRoster: 'Clear names',
  settingsAbout: 'Everything is stored on this phone only. No accounts, no server.',

  captureTitle: 'Receipt photo',
  captureSubtitle: 'Photograph the whole receipt, well lit and flat.',
  captureTake: 'Take a photo or pick an image',
  captureRetake: 'Another photo',
  captureRead: 'Read receipt',
  captureReading: 'Reading the receipt…',
  captureReadingHint: 'Usually takes a few seconds.',
  captureManualInstead: 'Enter it by hand',
  captureNeedCode: 'Enter the access code to read receipts.',
  captureCodeCta: 'Enter code',
  parseFailedTitle: "Couldn't read this receipt",
  parseFailedBody: 'Try another photo, or enter the bill by hand.',
  parseBadCode: 'That access code is wrong. Check it in settings.',
  parseRateLimited: 'Hourly receipt limit reached. Try again later.',
  parseTooLarge: 'The image is too big, even after shrinking it.',
  parseOffline: 'No connection. Reading a receipt needs the internet.',
  parseServerDown: "The reading service isn't responding right now.",
  parseCheckAfter: 'Always check the lines: thermal receipts are often misread.',

  errorGeneric: 'Something went wrong.',
  discardBill: 'Discard this bill',
  discardBillConfirm: 'Discard the current bill? Changes will be lost.',
};

const TABLES: Record<Lang, Record<keyof typeof es, string>> = { es, en };

export type StringKey = keyof typeof es;

/**
 * Look up a string, substituting `{placeholders}` from `vars`.
 * Missing placeholders are left as-is rather than rendering "undefined".
 */
export function translate(lang: Lang, key: StringKey, vars?: Record<string, string | number>): string {
  const template = TABLES[lang][key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export type Translator = (key: StringKey, vars?: Record<string, string | number>) => string;

export function translatorFor(lang: Lang): Translator {
  return (key, vars) => translate(lang, key, vars);
}
