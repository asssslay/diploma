# Опис інформаційної системи за функціональним та компонентним підходами

## 1. Загальна характеристика

Інформаційна система **UniCommunity** реалізована як модульна клієнт-серверна вебсистема. Компонентний підхід проявляється у поділі рішення на окремі частини з чітко визначеними зонами відповідальності: клієнтський застосунок, серверний API, шар доступу до даних, шар конфігурації середовища та інтеграції із зовнішніми сервісами. Функціональний підхід реалізовано через набір публічних функцій, які утворюють контракти між компонентами та забезпечують виконання прикладних сценаріїв.

У документі наведено лише ті публічні функції, які формують зовнішній або міжкомпонентний контракт системи під час виконання. Тестові функції, локальні допоміжні процедури та службові внутрішні обчислення до переліку не включались.

## 2. Ключові компоненти системи

| Компонент | Реалізація | Призначення |
| --- | --- | --- |
| Клієнтський компонент | `apps/web` | Відображення інтерфейсу, автентифікація користувача, взаємодія з API |
| Серверний компонент | `apps/server` | Обробка HTTP-запитів, бізнес-логіка, контроль доступу, моніторинг |
| Компонент доступу до даних | `packages/db` | Підключення до PostgreSQL/Supabase та опис структури БД |
| Компонент конфігурації | `packages/env` | Валідація та централізоване надання змінних середовища |
| Компонент інтеграцій | серверні модулі `emails`, `event-reminders`, `deadline-reminders` | Надсилання та планування повідомлень, інтеграція з Resend |

Зовнішній прикладний інтерфейс серверної частини опублікований у вигляді REST-маршрутів `/api/news`, `/api/events`, `/api/discussions`, `/api/notes`, `/api/deadlines`, `/api/profile`, `/api/settings`, `/api/admin/*`. Реалізацію цього інтерфейсу забезпечують функції, наведені нижче.

## 3. Компонент конфігурації середовища (`packages/env`)

| Публічна функція | Параметри | Повертає | Призначення |
| --- | --- | --- | --- |
| `createServerEnv(runtimeEnv)` | `runtimeEnv: Record<string, string \| undefined>` | readonly-об'єкт із параметрами `CORS_ORIGIN`, `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `MONITORING_TOKEN`, `NODE_ENV` | Валідує та формує конфігурацію серверної частини |
| `createWebEnv(runtimeEnv)` | `runtimeEnv: Record<string, string \| undefined>` | readonly-об'єкт із параметрами `VITE_SERVER_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Валідує та формує конфігурацію клієнтської частини |

## 4. Клієнтський компонент автентифікації та доступу до API (`apps/web`)

### 4.1. Підкомпонент автентифікації (`src/context/auth.tsx`)

| Публічна функція | Параметри | Повертає | Призначення |
| --- | --- | --- | --- |
| `AuthProvider({ children })` | `children: React.ReactNode` | `React`-елемент провайдера | Формує глобальний контекст автентифікації та профілю користувача |
| `useAuth()` | немає | `AuthContext` | Надає компонентам доступ до стану сесії та публічних дій автентифікації |
| `signIn(email, password)` | `email: string`, `password: string` | `Promise<{ error: string \| null; profile: Profile \| null }>` | Виконує вхід користувача та завантажує пов'язаний профіль |
| `signUp(email, password, metadata)` | `email: string`, `password: string`, `metadata: { full_name: string; group: string }` | `Promise<{ error: string \| null }>` | Реєструє нового користувача через Supabase Auth |
| `signOut()` | немає | `Promise<void>` | Завершує сесію користувача та очищає локальний стан профілю |

Примітка: функції `signIn`, `signUp` і `signOut` є частиною публічного контракту контексту, який повертає `useAuth()`.

### 4.2. Підкомпонент HTTP-взаємодії (`src/lib/api.ts`)

| Публічна функція | Параметри | Повертає | Призначення |
| --- | --- | --- | --- |
| `getApiClient()` | немає | `Promise<Hono API client>` | Створює типізований клієнт для виклику серверного API з автоматично підставленим bearer-токеном |
| `readApiErrorResponse(response)` | `response: Response` | `Promise<ApiErrorResponse \| null>` | Безпечно зчитує JSON-опис помилки із відповіді сервера |

## 5. Компонент керування доступом і персоналізацією (`activity-gate`)

Цей компонент реалізує функціональний механізм перевірки повноти профілю, доступу до коментування, створення обговорень і персоналізації профілю.

### 5.1. Серверні функції (`apps/server/src/lib/activity-gate.ts`)

| Публічна функція | Параметри | Повертає | Призначення |
| --- | --- | --- | --- |
| `buildActivityGate(profile, commentsPosted, registeredEventsCount)` | `profile: ActivityGateProfileRow`, `commentsPosted: number`, `registeredEventsCount: number` | `ActivityGate` | Обчислює підсумковий стан доступу на основі повноти профілю, кількості коментарів і реєстрацій на події |
| `getActivityGateForUser(userId)` | `userId: string` | `Promise<ActivityGate>` | Завантажує потрібні дані з БД та формує стан доступу для конкретного користувача |

### 5.2. Клієнтські функції (`apps/web/src/lib/activity-gate.ts`)

| Публічна функція | Параметри | Повертає | Призначення |
| --- | --- | --- | --- |
| `getRequiredProfileFieldLabel(field)` | `field: RequiredProfileField` | `string` | Повертає людинозрозумілу назву обов'язкового поля профілю |
| `getMissingProfileFieldLabels(fields)` | `fields: readonly RequiredProfileField[]` | `string[]` | Перетворює перелік відсутніх полів профілю у текстові підписи |
| `getCommentGateMessage(activityGate)` | `activityGate: ActivityGate` | `string` | Формує повідомлення про доступ або блокування коментування |
| `getDiscussionGateMessage(activityGate)` | `activityGate: ActivityGate` | `string` | Формує повідомлення про доступ або блокування створення обговорень |
| `getBackgroundGateMessage(activityGate)` | `activityGate: ActivityGate` | `string` | Формує повідомлення про доступ або блокування зміни фону профілю |

## 6. Компонент подій та реєстрації користувачів (`events`)

### 6.1. Функції реєстрації на події (`apps/server/src/lib/event-registration.ts`)

| Публічна функція | Параметри | Повертає | Призначення |
| --- | --- | --- | --- |
| `registerForEvent(eventId, studentId)` | `eventId: string`, `studentId: string` | `Promise<RegisteredEvent>` | Реєструє студента на подію з перевіркою дублювання та ліміту учасників |
| `syncEventRegistrationReminders(params)` | `params: { eventId, title, eventDate, location, studentId }` | `Promise<void>` | Після реєстрації синхронізує ідентифікатори запланованих нагадувань у БД |

### 6.2. Функції нагадувань про події (`apps/server/src/lib/event-reminders.ts`)

| Публічна функція | Параметри | Повертає | Призначення |
| --- | --- | --- | --- |
| `scheduleBothEventReminders(email, title, eventDate, location, operationId)` | `email: string`, `title: string`, `eventDate: Date`, `location: string`, `operationId: string` | `Promise<{ reminder24hEmailId: string \| null; reminder1hEmailId: string \| null }>` | Планує два повідомлення-нагадування про подію: за 24 години та за 1 годину |
| `cancelBothEventReminders(ids)` | `ids: Partial<EventReminderIds>` | `Promise<void>` | Скасовує обидва заплановані нагадування, якщо їх ідентифікатори існують |
| `cancelAllEventReminders(eventId)` | `eventId: string` | `Promise<number>` | Скасовує всі нагадування, пов'язані з конкретною подією |
| `rescheduleAllEventReminders(eventId, newTitle, newEventDate, newLocation)` | `eventId: string`, `newTitle: string`, `newEventDate: Date`, `newLocation: string` | `Promise<void>` | Перебудовує всі нагадування після редагування параметрів події |
| `cancelAllUserEventReminders(userId)` | `userId: string` | `Promise<void>` | Скасовує всі нагадування про події для конкретного користувача |
| `scheduleAllUserEventReminders(userId)` | `userId: string` | `Promise<void>` | Створює нагадування для всіх майбутніх реєстрацій користувача на події |

## 7. Компонент дедлайнів та нагадувань (`deadlines`)

### 7.1. Функції керування нагадуваннями (`apps/server/src/lib/deadline-reminders.ts`)

| Публічна функція | Параметри | Повертає | Призначення |
| --- | --- | --- | --- |
| `cancelAllUserDeadlineReminders(userId)` | `userId: string` | `Promise<void>` | Скасовує всі нагадування про дедлайни для конкретного користувача |
| `scheduleAllUserDeadlineReminders(userId)` | `userId: string` | `Promise<void>` | Створює нагадування для всіх майбутніх дедлайнів користувача |

## 8. Компонент електронних повідомлень (`emails`)

Функції цього компонента забезпечують формування шаблонів повідомлень, відправлення листів і відкладене планування нагадувань.

| Публічна функція | Параметри | Повертає | Призначення |
| --- | --- | --- | --- |
| `accountApprovedEmail(fullName)` | `fullName: string \| null` | `EmailTemplate` | Формує шаблон листа про схвалення облікового запису |
| `accountRejectedEmail(fullName, reason)` | `fullName: string \| null`, `reason: string` | `EmailTemplate` | Формує шаблон листа про відхилення заявки |
| `deadlineReminderEmail(title, dueAt, hoursBefore)` | `title: string`, `dueAt: Date`, `hoursBefore: number` | `EmailTemplate` | Формує шаблон листа-нагадування про дедлайн |
| `eventReminderEmail(title, eventDate, location, hoursBefore)` | `title: string`, `eventDate: Date`, `location: string`, `hoursBefore: number` | `EmailTemplate` | Формує шаблон листа-нагадування про подію |
| `sendEmail(to, template)` | `to: string`, `template: EmailTemplate` | `Promise<void>` | Надсилає транзакційний лист через сервіс Resend |
| `scheduleDeadlineReminder(to, title, dueAt, hoursBefore, operationId)` | `to: string`, `title: string`, `dueAt: Date`, `hoursBefore: number`, `operationId: string` | `Promise<string \| null>` | Планує лист-нагадування про дедлайн і повертає ідентифікатор запланованого листа |
| `scheduleEventReminder(to, title, eventDate, location, hoursBefore, operationId)` | `to: string`, `title: string`, `eventDate: Date`, `location: string`, `hoursBefore: number`, `operationId: string` | `Promise<string \| null>` | Планує лист-нагадування про подію і повертає ідентифікатор запланованого листа |
| `cancelScheduledEmail(emailId)` | `emailId: string` | `Promise<boolean>` | Скасовує раніше запланований лист за його ідентифікатором |

## 9. Серверний інфраструктурний компонент (`apps/server/src/lib`)

### 9.1. Побудова маршрутизатора та контроль доступу

| Публічна функція | Параметри | Повертає | Призначення |
| --- | --- | --- | --- |
| `createRouter()` | немає | `Hono`-застосунок/маршрутизатор | Створює базовий маршрутизатор для серверних модулів |
| `verifyAccessToken(token)` | `token: string` | `Promise<{ id: string; email?: string } \| null>` | Перевіряє access token користувача через Supabase та повертає автентифікованого користувача |
| `validationHook(result, c)` | `result: HookResult`, `c: Context` | `JSON`-відповідь з кодом `422` або `undefined` | Уніфікує повернення помилок валідації для вхідних параметрів API |

### 9.2. Підтримувальні серверні функції

| Публічна функція | Параметри | Повертає | Призначення |
| --- | --- | --- | --- |
| `runThrottled(tasks, ratePerSecond = 4)` | `tasks: Array<() => Promise<T>>`, `ratePerSecond: number` | `Promise<T[]>` | Послідовно виконує асинхронні задачі з обмеженням швидкості викликів |
| `countNewsPostsTotal()` | немає | `Promise<number>` | Повертає загальну кількість новин у системі |
| `createNewsExcerpt(content, maxLength = 120)` | `content: string`, `maxLength: number` | `string` | Формує короткий текстовий анонс для списку новин |

### 9.3. Функції телеметрії та моніторингу

| Публічна функція | Параметри | Повертає | Призначення |
| --- | --- | --- | --- |
| `shouldTrackRequest(pathname)` | `pathname: string` | `boolean` | Визначає, чи треба включати запит до статистики часу відповіді |
| `recordRequestDuration(durationMs, timestampMs = Date.now())` | `durationMs: number`, `timestampMs: number` | `void` | Зберігає тривалість обробки запиту для подальшого аналізу |
| `getTelemetrySnapshot(nowMs = Date.now())` | `nowMs: number` | об'єкт телеметрії | Повертає агрегований стан процесу: використання CPU, пам'яті, середню затримку та час роботи |

## 10. Компонент доступу до даних (`packages/db`)

Шар доступу до даних у цій системі є компонентом ресурсного типу. Його публічний інтерфейс представлений переважно не окремими функціями, а експортованими об'єктами підключення та схемами даних:

- `db` — типізоване підключення Drizzle ORM до PostgreSQL;
- `supabaseAdmin` — привілейований серверний клієнт Supabase;
- `supabase` — клієнт Supabase для браузерної частини;
- `schema.ts` — набір публічних описів сутностей: `profiles`, `studentProfiles`, `studentApplications`, `userSettings`, `newsPosts`, `events`, `eventRegistrations`, `discussions`, `discussionComments`, `discussionReactions`, `commentReactions`, `notes`, `deadlines`.

Такий спосіб організації відповідає компонентному підходу, оскільки шар даних винесено в окремий пакет із чітким інтерфейсом підключення, а прикладна поведінка над цими сутностями реалізується на рівні функцій серверного компонента.

## 11. Висновок

Отже, інформаційна система побудована на основі поєднання компонентного та функціонального підходів. Компонентність забезпечує поділ рішення на незалежні модулі `web`, `server`, `db` та `env`, а функціональний підхід проявляється у використанні публічних типізованих функцій для реалізації автентифікації, контролю доступу, реєстрації на події, планування нагадувань, відправлення електронних листів та моніторингу. Така організація спрощує супровід системи, тестування та подальше розширення її функціональності.
