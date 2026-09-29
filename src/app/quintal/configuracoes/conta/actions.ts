"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionCaregiver } from "@/lib/authorization";
import { updateCaregiverProfile } from "@/lib/familyContext";
import {
  updateCaregiverProfileInputSchema,
  caregiverPersonalPreferencesInputSchema,
  caregiverNotificationPreferencesInputSchema,
} from "@/lib/validation/profile";
import {
  updateCaregiverPersonalPreferences,
  updateCaregiverNotificationPreferences,
} from "@/lib/caregiverPreferences";

export async function updateCaregiverProfileAction(formData: FormData) {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const parsed = updateCaregiverProfileInputSchema.safeParse({
    name: formData.get("name"),
    avatar_url: formData.get("avatar_url"),
  });
  if (!parsed.success) {
    redirect(`/quintal/configuracoes/conta?aba=perfil&error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  try {
    await updateCaregiverProfile(session.caregiverId, { name: parsed.data.name, avatarUrl: parsed.data.avatar_url });
  } catch {
    redirect(
      `/quintal/configuracoes/conta?aba=perfil&error=${encodeURIComponent("Não foi possível salvar. Tente de novo.")}`,
    );
  }

  revalidatePath("/quintal/configuracoes/conta");
  revalidatePath("/quintal/configuracoes");
  redirect("/quintal/configuracoes/conta?aba=perfil&success=1");
}

export async function updateCaregiverPersonalPreferencesAction(formData: FormData) {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const parsed = caregiverPersonalPreferencesInputSchema.safeParse({
    content_interests: formData.getAll("content_interests"),
    communication_style: formData.get("communication_style"),
  });
  if (!parsed.success) {
    redirect(
      `/quintal/configuracoes/conta?aba=preferencias&error=${encodeURIComponent(parsed.error.issues[0].message)}`,
    );
  }

  try {
    await updateCaregiverPersonalPreferences(session.caregiverId, {
      contentInterests: parsed.data.content_interests,
      communicationStyle: parsed.data.communication_style,
    });
  } catch {
    redirect(
      `/quintal/configuracoes/conta?aba=preferencias&error=${encodeURIComponent("Não foi possível salvar. Tente de novo.")}`,
    );
  }

  revalidatePath("/quintal/configuracoes/conta");
  redirect("/quintal/configuracoes/conta?aba=preferencias&success=1");
}

export async function updateCaregiverNotificationPreferencesAction(formData: FormData) {
  const session = await getSessionCaregiver();
  if (!session) {
    redirect("/comecar");
  }

  const parsed = caregiverNotificationPreferencesInputSchema.safeParse({
    notify_general: formData.get("notify_general"),
    notify_reminders: formData.get("notify_reminders"),
    notify_recommendations: formData.get("notify_recommendations"),
    notify_routine_updates: formData.get("notify_routine_updates"),
  });
  if (!parsed.success) {
    redirect(
      `/quintal/configuracoes/conta?aba=notificacoes&error=${encodeURIComponent(parsed.error.issues[0].message)}`,
    );
  }

  try {
    await updateCaregiverNotificationPreferences(session.caregiverId, {
      notifyGeneral: parsed.data.notify_general,
      notifyReminders: parsed.data.notify_reminders,
      notifyRecommendations: parsed.data.notify_recommendations,
      notifyRoutineUpdates: parsed.data.notify_routine_updates,
    });
  } catch {
    redirect(
      `/quintal/configuracoes/conta?aba=notificacoes&error=${encodeURIComponent("Não foi possível salvar. Tente de novo.")}`,
    );
  }

  revalidatePath("/quintal/configuracoes/conta");
  redirect("/quintal/configuracoes/conta?aba=notificacoes&success=1");
}
