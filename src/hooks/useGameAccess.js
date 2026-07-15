import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";

const FREE_LEVELS_DEFAULT = 10;
const PRICE_DEFAULT = 19.9;

export function useGameAccess(gameId) {
  const [deviceCode, setDeviceCode] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  const [price, setPrice] = useState(PRICE_DEFAULT);
  const [freeLevels, setFreeLevels] = useState(FREE_LEVELS_DEFAULT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let code = localStorage.getItem(`device_code_${gameId}`);
    if (!code) {
      code = "dev_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
      localStorage.setItem(`device_code_${gameId}`, code);
    }
    setDeviceCode(code);

    const localUnlock = localStorage.getItem(`game_unlocked_${gameId}`);
    if (localUnlock === "true") {
      setIsPremium(true);
    }

    const fetchData = async () => {
      try {
        const configRes = await base44.functions.invoke("manageGamePlans", {
          operation: "getGameConfig",
          game_id: gameId,
        });
        if (configRes.data) {
          setPrice(configRes.data.price ?? PRICE_DEFAULT);
          setFreeLevels(configRes.data.free_levels ?? FREE_LEVELS_DEFAULT);
        }

        const unlockRes = await base44.functions.invoke("manageGamePlans", {
          operation: "checkUnlock",
          device_code: code,
          game_id: gameId,
        });
        if (unlockRes.data?.unlocked) {
          setIsPremium(true);
          localStorage.setItem(`game_unlocked_${gameId}`, "true");
        }
      } catch (e) {
        console.error("Failed to fetch game access:", e);
      }
      setLoading(false);
    };
    fetchData();
  }, [gameId]);

  const requestUnlock = useCallback(
    async (contactInfo) => {
      if (!deviceCode) return null;
      try {
        const res = await base44.functions.invoke("manageGamePlans", {
          operation: "requestUnlock",
          device_code: deviceCode,
          game_id: gameId,
          contact_info: contactInfo || "",
        });
        return res.data;
      } catch (e) {
        console.error(e);
        return null;
      }
    },
    [deviceCode, gameId]
  );

  return { deviceCode, isPremium, price, freeLevels, loading, requestUnlock };
}