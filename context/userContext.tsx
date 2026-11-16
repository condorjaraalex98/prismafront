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
import { Alert, AppState, AppStateStatus, Platform } from "react-native";

// ⏱️ Inactividad: 45 minutos (en milisegundos)
const TIEMPO_INACTIVIDAD = 45 * 60 * 1000;

// 🕒 Tiempo máximo de turno: 12 horas (en milisegundos)
const TIEMPO_MAXIMO_SESION = 12 * 60 * 60 * 1000;

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
}

interface AuthContextType {
  userData: User | null;
  loading: boolean;
  login: (data: User) => Promise<void>;
  logout: (motivo?: "inactividad" | "tiempo_maximo") => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const mostrarAlerta = (titulo: string, mensaje: string) => {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && typeof window.alert === "function") {
      window.alert(`${titulo}\n\n${mensaje}`);
    }
  } else {
    Alert.alert(titulo, mensaje);
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const logout = useCallback(
    async (motivo?: "inactividad" | "tiempo_maximo") => {
      try {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        await AsyncStorage.removeItem("@user_session");
        setUserData(null);
        setLoading(false);

        if (motivo === "tiempo_maximo") {
          mostrarAlerta(
            "Sesión Expirada",
            "El tiempo máximo de servicio (12 horas) ha finalizado. Por favor, inicia sesión nuevamente."
          );
        } else if (motivo === "inactividad") {
          mostrarAlerta(
            "Sesión Cerrada",
            "Tu sesión se ha cerrado por inactividad prolongada."
          );
        }
      } catch (e) {
        console.error("Error al cerrar sesión:", e);
      }
    },
    []
  );

  // 1. Cargar datos de sesión al iniciar la app y validar tiempos
  useEffect(() => {
    let mounted = true;
    const loadStorageData = async () => {
      try {
        const jsonValue = await AsyncStorage.getItem("@user_session");
        if (jsonValue != null && mounted) {
          const session: SessionData = JSON.parse(jsonValue);
          const ahora = Date.now();

          if (ahora - session.loginTime > TIEMPO_MAXIMO_SESION) {
            await logout("tiempo_maximo");
            return;
          }

          setUserData(session.user);
        }
      } catch (e) {
        console.error("Error cargando sesión:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadStorageData();
    return () => {
      mounted = false;
    };
  }, [logout]);

  // 2. Reiniciar temporizador de inactividad (45 min)
  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (userData) {
      timerRef.current = setTimeout(() => {
        logout("inactividad");
      }, TIEMPO_INACTIVIDAD);
    }
  }, [userData, logout]);

  // 3. Listener global de cambio de estado de la app
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        try {
          const jsonValue = await AsyncStorage.getItem("@user_session");
          if (jsonValue != null) {
            const session: SessionData = JSON.parse(jsonValue);
            if (Date.now() - session.loginTime > TIEMPO_MAXIMO_SESION) {
              await logout("tiempo_maximo");
              return;
            }
          }
        } catch (e) {
          console.error("Error validando sesión en background:", e);
        }

        resetTimer();
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    if (userData) {
      resetTimer();
    }

    return () => {
      subscription.remove();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [userData, logout, resetTimer]);

  const login = useCallback(async (data: User) => {
    try {
      const sessionData: SessionData = {
        user: data,
        loginTime: Date.now(),
      };
      await AsyncStorage.setItem("@user_session", JSON.stringify(sessionData));
      setUserData(data);
    } catch (e) {
      console.error("Error guardando sesión:", e);
    }
  }, []);

  const contextValue = useMemo(
    () => ({ userData, login, logout, loading }),
    [userData, login, logout, loading]
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return context;
};