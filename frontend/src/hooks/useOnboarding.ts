import { useState, useEffect, useCallback, useRef } from 'react';
import { getOnboardingState, updateOnboardingState, UserOnboardingState } from '../api';

const LOCAL_STORAGE_PREFIX = 'vexors_onboarding_';

export function useOnboarding(userId?: number) {
  const [onboardingState, setOnboardingState] = useState<UserOnboardingState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const isFetchingRef = useRef<boolean>(false);

  const fetchState = useCallback(async () => {
    if (!userId || isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const state = await getOnboardingState();
      setOnboardingState(state);

      // Sincroniza cache local com a data de reset do admin
      const lastResetKey = `${LOCAL_STORAGE_PREFIX}last_reset_${userId}`;
      const savedReset = localStorage.getItem(lastResetKey);
      if (state.onboarding_reset_at && state.onboarding_reset_at !== savedReset) {
        // Admin resetou o onboarding: limpa chaves locais
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith(`${LOCAL_STORAGE_PREFIX}user_${userId}_`)) {
            localStorage.removeItem(key);
          }
        });
        localStorage.setItem(lastResetKey, state.onboarding_reset_at);
      }
    } catch (e) {
      // Fallback silencioso
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [userId]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const shouldShowInitialTour = useCallback(
    (websiteId: number | string, isConnected: boolean): boolean => {
      if (!userId || !onboardingState) return false;
      // Só exibe no primeiro site do usuário
      if (!onboardingState.is_first_site) return false;
      if (onboardingState.initial_tour_completed) return false;

      const localKey = `${LOCAL_STORAGE_PREFIX}user_${userId}_site_${websiteId}_initial_tour`;
      if (localStorage.getItem(localKey) === 'completed') return false;

      // Se não conectou ainda, exibe o tour
      return !isConnected;
    },
    [userId, onboardingState]
  );

  const markInitialTourCompleted = useCallback(
    async (websiteId: number | string) => {
      if (!userId) return;
      const localKey = `${LOCAL_STORAGE_PREFIX}user_${userId}_site_${websiteId}_initial_tour`;
      localStorage.setItem(localKey, 'completed');

      setOnboardingState((prev) => (prev ? { ...prev, initial_tour_completed: true } : prev));
      try {
        await updateOnboardingState({ initial_tour_completed: true });
      } catch (e) {
        // ignore
      }
    },
    [userId]
  );

  const shouldShowToolIntro = useCallback(
    (toolKey: string): boolean => {
      if (!userId || !onboardingState) return false;
      // Só exibe as dicas de ferramentas no primeiro site
      if (!onboardingState.is_first_site) return false;

      // Verifica se o backend já tem essa ferramenta como vista
      if (onboardingState.tools_seen.includes(toolKey)) return false;

      // Verifica cache local
      const localKey = `${LOCAL_STORAGE_PREFIX}user_${userId}_tool_${toolKey}`;
      if (localStorage.getItem(localKey) === 'seen') return false;

      return true;
    },
    [userId, onboardingState]
  );

  const markToolAsSeen = useCallback(
    async (toolKey: string) => {
      if (!userId) return;
      const localKey = `${LOCAL_STORAGE_PREFIX}user_${userId}_tool_${toolKey}`;
      localStorage.setItem(localKey, 'seen');

      setOnboardingState((prev) => {
        if (!prev) return prev;
        const currentTools = prev.tools_seen || [];
        if (!currentTools.includes(toolKey)) {
          return { ...prev, tools_seen: [...currentTools, toolKey] };
        }
        return prev;
      });

      try {
        await updateOnboardingState({ tool_seen: toolKey });
      } catch (e) {
        // ignore
      }
    },
    [userId]
  );

  return {
    onboardingState,
    loading,
    refetchOnboarding: fetchState,
    shouldShowInitialTour,
    markInitialTourCompleted,
    shouldShowToolIntro,
    markToolAsSeen,
  };
}
