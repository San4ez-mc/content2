import { redirect } from "next/navigation";

// Стара адреса «Типи контенту» → нова «Структури». Лишаємо редірект для закладок.
export default function ContentTypesRedirect() {
  redirect("/structures");
}
