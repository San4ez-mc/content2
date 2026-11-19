import { randomBytes } from "crypto";

// Секрети вебхуків і планувальника беруться ТІЛЬКИ з оточення (.env сервера). Запасного значення в коді немає.
// Якщо змінної нема, процес отримує випадковий секрет, який не знає ніхто: ендпоінти закриті, а не відкриті для всіх.
const unguessable = () => randomBytes(24).toString("hex");

export const WEBHOOK_SECRET: string = process.env.WEBHOOK_SECRET || unguessable();
export const SCHEDULER_TOKEN: string = process.env.SCHEDULER_TOKEN || unguessable();
