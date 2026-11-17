
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  AppState,
  AppStateStatus,
  Platform,
  View,
} from "react-native";

const TIEMPO_INACTIVIDAD = 45 * 60 * 1000;
const TIEMPO_MAXIMO_SESION = 12 * 60 * 60 * 1000;
const INTERVALO_GUARDADO_ACTIVIDAD = 15000;
const UMBRAL_EVENTO_ACTIVIDAD = 1000;

interface User {
  id: number;
  usuario: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
  rol: string;
  id_rol: number;
  dni?: string | number;
  documento_numero?: string | number;
}

interface SessionData {
  user: User;
  loginTime: number;
  lastActivityTime?: number;
}

type LogoutReason = "inactividad" | "tiempo_maximo";

interface AuthContextType {
  userData: User | null;
  loading: boolean;
  login: (data: User) => Promise<void>;
  logout: (motivo?: LogoutReason) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const mostrarAlerta = (titulo: string, mensaje: string) => {
  try {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        window.alert(`${titulo}\n\n${mensaje}`);
      }
    } else {
      Alert.alert(titulo, mensaje);
    }
  } catch (error) {
    console.error("Error mostrando alerta:", error);
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef(0);
  const loginTimeRef = useRef(0);
  const lastPersistRef = useRef(0);
  const lastEventRef = useRef(0);
  const logoutLockRef = useRef(false);
  const userRef = useRef<User | null>(null);

  const limpiarTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const logout = useCallback(
    async (motivo?: LogoutReason) => {
      if (logoutLockRef.current) return;

      logoutLockRef.current = true;
      limpiarTimer();

      userRef.current = null;
      lastActivityRef.current = 0;
      loginTimeRef.current = 0;
      lastPersistRef.current = 0;

      try {
        await AsyncStorage.removeItem("@user_session");
      } catch (error) {
        console.error("Error eliminando sesión:", error);
      } finally {
        setUserData(null);
        setLoading(false);
      }

      if (motivo === "tiempo_maximo") {
        mostrarAlerta(
          "Sesión expirada",
          "El tiempo máximo de servicio (12 horas) ha finalizado. Por favor, inicia sesión nuevamente."
        );
      } else if (motivo === "inactividad") {
        mostrarAlerta(
          "Sesión cerrada",
          "Tu sesión se ha cerrado por 45 minutos de inactividad."
        );
      }

      logoutLockRef.current = false;
    },
    [limpiarTimer]
  );

  const validarTiempo = useCallback((): LogoutReason | null => {
    if (!userRef.current) return null;

    const ahora = Date.now();

    if (
      !loginTimeRef.current ||
      ahora - loginTimeRef.current >= TIEMPO_MAXIMO_SESION
    ) {
      return "tiempo_maximo";
    }

    if (
      !lastActivityRef.current ||
      ahora - lastActivityRef.current >= TIEMPO_INACTIVIDAD
    ) {
      return "inactividad";
    }

    return null;
  }, []);

  const programarTimer = useCallback(() => {
    limpiarTimer();

    if (!userRef.current || logoutLockRef.current) return;

    const ahora = Date.now();

    const restanteInactividad =
      TIEMPO_INACTIVIDAD - (ahora - lastActivityRef.current);

    const restanteSesion =
      TIEMPO_MAXIMO_SESION - (ahora - loginTimeRef.current);

    const restante = Math.min(
      restanteInactividad,
      restanteSesion
    );

    timerRef.current = setTimeout(async () => {
      const motivo = validarTiempo();

      if (motivo) {
        await logout(motivo);
      } else {
        programarTimer();
      }
    }, Math.max(100, restante));
  }, [limpiarTimer, validarTiempo, logout]);

  const registrarActividad = useCallback(() => {
    if (!userRef.current || logoutLockRef.current) return;

    const ahora = Date.now();

    // Evita procesar demasiados eventos de movimiento.
    if (ahora - lastEventRef.current < UMBRAL_EVENTO_ACTIVIDAD) {
      return;
    }

    lastEventRef.current = ahora;

    const motivo = validarTiempo();

    if (motivo) {
      void logout(motivo);
      return;
    }

    lastActivityRef.current = ahora;

    programarTimer();

    // Guardado limitado para evitar escrituras constantes.
    if (
      ahora - lastPersistRef.current >=
      INTERVALO_GUARDADO_ACTIVIDAD
    ) {
      lastPersistRef.current = ahora;

      void AsyncStorage.getItem("@user_session")
        .then(async (json) => {
          if (!json || !userRef.current) return;

          const session: SessionData = JSON.parse(json);

          await AsyncStorage.setItem(
            "@user_session",
            JSON.stringify({
              ...session,
              lastActivityTime: ahora,
            })
          );
        })
        .catch((error) => {
          console.error(
            "Error guardando actividad:",
            error
          );
        });
    }
  }, [validarTiempo, logout, programarTimer]);

  // Recuperar y validar sesión almacenada.
  useEffect(() => {
    let mounted = true;

    const cargarSesion = async () => {
      try {
        const json = await AsyncStorage.getItem("@user_session");

        if (!json || !mounted) return;

        const session: SessionData = JSON.parse(json);

        const loginTime = Number(session.loginTime);
        const lastActivityTime = Number(
          session.lastActivityTime ?? session.loginTime
        );

        if (
          !session.user ||
          !Number.isFinite(loginTime) ||
          !Number.isFinite(lastActivityTime) ||
          loginTime <= 0 ||
          lastActivityTime <= 0
        ) {
          await AsyncStorage.removeItem("@user_session");
          return;
        }

        const ahora = Date.now();

        if (ahora - loginTime >= TIEMPO_MAXIMO_SESION) {
          await AsyncStorage.removeItem("@user_session");

          if (mounted) {
            mostrarAlerta(
              "Sesión expirada",
              "El tiempo máximo de servicio (12 horas) ha finalizado."
            );
          }
          return;
        }

        if (ahora - lastActivityTime >= TIEMPO_INACTIVIDAD) {
          await AsyncStorage.removeItem("@user_session");

          if (mounted) {
            mostrarAlerta(
              "Sesión cerrada",
              "Tu sesión se ha cerrado por inactividad."
            );
          }
          return;
        }

        if (!mounted) return;

        userRef.current = session.user;
        loginTimeRef.current = loginTime;
        lastActivityRef.current = lastActivityTime;
        lastPersistRef.current = lastActivityTime;

        setUserData(session.user);
        programarTimer();
      } catch (error) {
        console.error("Error recuperando sesión:", error);

        try {
          await AsyncStorage.removeItem("@user_session");
        } catch (storageError) {
          console.error("Error limpiando sesión:", storageError);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void cargarSesion();

    return () => {
      mounted = false;
    };
  }, [programarTimer]);

  // Control de actividad y regreso desde segundo plano.
  useEffect(() => {
    const handleAppStateChange = (
      nextState: AppStateStatus
    ) => {
      if (nextState === "active" && userRef.current) {
        const motivo = validarTiempo();

        if (motivo) {
          void logout(motivo);
          return;
        }

        registrarActividad();
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    return () => {
      subscription.remove();
    };
  }, [validarTiempo, logout, registrarActividad]);

  // Eventos globales para Expo Web.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      return;
    }

    const eventos = [
      "pointerdown",
      "pointermove",
      "keydown",
      "click",
      "wheel",
      "touchstart",
    ] as const;

    const handleActivity = () => registrarActividad();

    eventos.forEach((evento) => {
      window.addEventListener(evento, handleActivity, {
        passive: true,
      });
    });

    return () => {
      eventos.forEach((evento) => {
        window.removeEventListener(evento, handleActivity);
      });
    };
  }, [registrarActividad]);

  const login = useCallback(
    async (data: User) => {
      try {
        limpiarTimer();

        logoutLockRef.current = false;

        const ahora = Date.now();

        const sessionData: SessionData = {
          user: data,
          loginTime: ahora,
          lastActivityTime: ahora,
        };

        await AsyncStorage.setItem(
          "@user_session",
          JSON.stringify(sessionData)
        );

        userRef.current = data;
        loginTimeRef.current = ahora;
        lastActivityRef.current = ahora;
        lastPersistRef.current = ahora;
        lastEventRef.current = ahora;

        setUserData(data);
        setLoading(false);

        programarTimer();
      } catch (error) {
        console.error("Error guardando sesión:", error);
        throw error;
      }
    },
    [limpiarTimer, programarTimer]
  );

  // Limpieza definitiva al desmontar el proveedor.
  useEffect(() => {
    return () => {
      limpiarTimer();
    };
  }, [limpiarTimer]);

  const contextValue = useMemo(
    () => ({
      userData,
      loading,
      login,
      logout,
    }),
    [userData, loading, login, logout]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      <View
        style={{ flex: 1 }}
        onTouchStart={registrarActividad}
        onTouchMove={registrarActividad}
      >
        {children}
      </View>
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth debe utilizarse dentro de AuthProvider"
    );
  }

  return context;
};
