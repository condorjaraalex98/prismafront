
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { DrawerContentScrollView } from "expo-router/drawer";
import React, { memo, useCallback, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useAuth } from "../context/userContext";

export const Sidebar = (props: any) => {
  const { userData, logout, loading } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();

  // Plataforma y tamaño de pantalla
  const isWeb = Platform.OS === "web";
  const isSmallScreen = width < 768;
  const esMovil = !isWeb || isSmallScreen;

  const activeRoute = props.state?.routes[props.state.index]?.name;
  const [openSection, setOpenSection] = useState<string | null>(null);

  // Normalizar el rol desde el inicio
  const userRolId = Number(userData?.id_rol ?? 0);

  const { isExpanded } = props;
  const mostrarTexto = isExpanded || isSmallScreen;

  const handleToggleSection = useCallback((sectionLabel: string) => {
    setOpenSection((prev) =>
      prev === sectionLabel ? null : sectionLabel
    );
  }, []);

  const navigateTo = useCallback(
    (route: string) => {
      if (isSmallScreen && props.navigation?.closeDrawer) {
        props.navigation.closeDrawer();

        requestAnimationFrame(() => {
          router.push(`/${route}` as any);
        });
      } else {
        router.push(`/${route}` as any);
      }
    },
    [isSmallScreen, props.navigation, router]
  );

  const handleLogout = useCallback(async () => {
    if (
      Platform.OS === "web" &&
      typeof window !== "undefined"
    ) {
      window.localStorage.removeItem("prisma_catalogos_tele_v1");
    }

    await logout();
    router.replace("/");
  }, [logout, router]);

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  // Permisos por rol y dispositivo
  const showMobileStats =
    userRolId === 1 ||
    ((userRolId === 2 || userRolId === 3) && esMovil);

  const showWebStats =
    (userRolId === 1 || userRolId === 3) && !esMovil;

 const showOtros = showMobileStats || showWebStats;
  const showRankingSection = showOtros || userRolId === 6;

  return (
    <View style={styles.container}>
      <DrawerContentScrollView
        {...props}
        showsVerticalScrollIndicator={false}
      >
        {/* CABECERA */}
        {mostrarTexto && (
          <View style={styles.sidebarHeader}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarLargeText}>
                {userData?.nombres
                  ? userData.nombres[0].toUpperCase()
                  : "U"}
              </Text>
            </View>

            <View style={styles.userInfo}>
              <Text style={styles.userName}>
                {userData?.nombres} {userData?.apellido_paterno}
              </Text>
              <Text style={styles.userRole}>
                {userData?.rol || "Usuario"}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.divider} />

        {/* REGISTRO DE CAMPO - MÓVIL */}
        {[1, 2, 3,6].includes(userRolId) && esMovil && (
          <MenuOption
            icon="home-outline"
            label="Reg. Campo"
            isActive={activeRoute === "principal"}
            isExpanded={mostrarTexto}
            onPress={() => navigateTo("principal")}
          />
        )}

        {/* REGISTRO CECOM - WEB */}
        {[1, 2, 3,6].includes(userRolId) && !esMovil && (
          <MenuOption
            icon="home-outline"
            label="Reg. CECOM"
            isActive={activeRoute === "cecomdoceh"}
            isExpanded={mostrarTexto}
            onPress={() => navigateTo("cecomdoceh")}
          />
        )}

      {/* RANKING */}
        {showRankingSection && (
          <CollapsibleSection
            icon="stats-chart-outline"
            label="RANKING DIARIO"
            isExpanded={mostrarTexto}
            isOpen={openSection === "Ranking"}
            onToggle={() => handleToggleSection("Ranking")}
          >
            {(showMobileStats || userRolId === 6) && (
              <MenuOption
                icon="stats-chart-outline"
                label="Est. CAMPO"
                isActive={activeRoute === "rcampo"}
                isExpanded={true}
                onPress={() => navigateTo("rcampo")}
                isSubItem
              />
            )}

            {showMobileStats && (
              <MenuOption
                icon="stats-chart-outline"
                label="Est. MOTO"
                isActive={activeRoute === "rcampomoto"}
                isExpanded={true}
                onPress={() => navigateTo("rcampomoto")}
                isSubItem
              />
            )}

            {showWebStats && (
              <MenuOption
                icon="stats-chart-outline"
                label="Est. CECOM"
                isActive={activeRoute === "rcecom"}
                isExpanded={true}
                onPress={() => navigateTo("rcecom")}
                isSubItem
              />
            )}
          </CollapsibleSection>
        )}

       
        {/* MANTENIMIENTO */}
        {userRolId === 1 && (
          <CollapsibleSection
            label="MANTENIMIENTO"
            icon="settings-outline"
            isExpanded={mostrarTexto}
            isOpen={openSection === "Mantenimiento"}
            onToggle={() => handleToggleSection("Mantenimiento")}
          >
            <MenuOption
              icon="person-outline"
              label="Usuario"
              isActive={activeRoute === "usuario"}
              isExpanded={true}
              onPress={() => navigateTo("usuario")}
              isSubItem
            />

            <MenuOption
              icon="shield-outline"
              label="PNP"
              isActive={activeRoute === "crudpnp"}
              isExpanded={true}
              onPress={() => navigateTo("crudpnp")}
              isSubItem
            />

            <MenuOption
              icon="car-outline"
              label="Unidades"
              isActive={activeRoute === "crudunidades"}
              isExpanded={true}
              onPress={() => navigateTo("crudunidades")}
              isSubItem
            />

            <MenuOption
              icon="git-branch-outline"
              label="Vía"
              isActive={activeRoute === "crudvia"}
              isExpanded={true}
              onPress={() => navigateTo("crudvia")}
              isSubItem
            />

            <MenuOption
              icon="location-outline"
              label="Lugar"
              isActive={activeRoute === "crudlugar"}
              isExpanded={true}
              onPress={() => navigateTo("crudlugar")}
              isSubItem
            />

            {isWeb && (
              <>
                <MenuOption
                  icon="business-outline"
                  label="Departamento"
                  isActive={activeRoute === "departamento"}
                  isExpanded={true}
                  onPress={() => navigateTo("departamento")}
                  isSubItem
                />

                <MenuOption
                  icon="map-outline"
                  label="Distrito"
                  isActive={activeRoute === "distrito"}
                  isExpanded={true}
                  onPress={() => navigateTo("distrito")}
                  isSubItem
                />
              </>
            )}
          </CollapsibleSection>
        )}

        {/* MATRIZ */}
        {userRolId === 1 && isWeb && (
          <CollapsibleSection
            label="MATRIZ"
            icon="grid-outline"
            isExpanded={mostrarTexto}
            isOpen={openSection === "matriz"}
            onToggle={() => handleToggleSection("matriz")}
          >
            <MenuOption
              icon="radio-outline"
              label="Principal"
              isActive={activeRoute === "principal"}
              isExpanded={true}
              onPress={() => navigateTo("principal")}
              isSubItem
            />
 <MenuOption
              icon="pie-chart-outline"
              label="Dashboard General"
              isActive={activeRoute === "estadist"}
              isExpanded={true}
              onPress={() => navigateTo("estadist")}
              isSubItem
            />
            <MenuOption
              icon="radio-outline"
              label="DASH 2 KILO"
              isActive={activeRoute === "cecomsuper"}
              isExpanded={true}
              onPress={() => navigateTo("cecomsuper")}
              isSubItem
            />
          </CollapsibleSection>
        )}

        {/* ESTADÍSTICA */}
        {(userRolId === 6 || userRolId === 1) && isWeb && (
          <CollapsibleSection
            label="ESTADÍSTICA"
            icon="bar-chart-outline"
            isExpanded={mostrarTexto}
            isOpen={openSection === "ESTADISTICA"}
            onToggle={() => handleToggleSection("ESTADISTICA")}
          >

             <MenuOption
              icon="pie-chart-outline"
              label="Rol de Servicio"
              isActive={activeRoute === "rolservicio"}
              isExpanded={true}
              onPress={() => navigateTo("rolservicio")}
              isSubItem
            />
           
<MenuOption
              icon="pie-chart-outline"
              label="Dashboard Cecom"
              isActive={activeRoute === "estadistcec"}
              isExpanded={true}
              onPress={() => navigateTo("estadistcec")}
              isSubItem
            />
            
          </CollapsibleSection>
        )}

{/* OTROS */}
        {(showOtros || userRolId === 6) && (
          <CollapsibleSection
            icon="compass-outline"
            label="OTROS"
            isExpanded={mostrarTexto}
            isOpen={openSection === "Otros"}
            onToggle={() => handleToggleSection("Otros")}
          >
            {(showOtros || userRolId === 6) && (
              <MenuOption
                icon="map-outline"
                label="Mapas"
                isActive={activeRoute === "mapa"}
                isExpanded={true}
                onPress={() => navigateTo("mapa")}
                isSubItem
              />
            )}

            {userRolId === 1 && (
              <MenuOption
                icon="pin-outline"
                label="Puntos"
                isActive={activeRoute === "puntos"}
                isExpanded={true}
                onPress={() => navigateTo("puntos")}
                isSubItem
              />
            )}
          </CollapsibleSection>
        )}


        {/* SIPCOP */}
        {(userRolId === 2 || userRolId === 1) && isWeb && (
          <CollapsibleSection
            label="SIPCOP"
            icon="document-text-outline"
            isExpanded={mostrarTexto}
            isOpen={openSection === "SIPCOP"}
            onToggle={() => handleToggleSection("SIPCOP")}
          >
            <MenuOption
              icon="location-outline"
              label="Descarga"
              isActive={activeRoute === "cecom"}
              isExpanded={true}
              onPress={() => navigateTo("cecom")}
              isSubItem
            />

            <MenuOption
              icon="download-outline"
              label="Exportar"
              isActive={activeRoute === "exportar"}
              isExpanded={true}
              onPress={() => navigateTo("exportar")}
              isSubItem
            />

            <MenuOption
              icon="calendar-number-outline"
              label="Exportar Rango"
              isActive={activeRoute === "exportarango"}
              isExpanded={true}
              onPress={() => navigateTo("exportarango")}
              isSubItem
            />
          </CollapsibleSection>
        )}

        {/* DRONES */}
        {(userRolId === 4 || userRolId === 1) && (
          <MenuOption
            icon="navigate-outline"
            label="Drones"
            isActive={activeRoute === "principalDron"}
            isExpanded={mostrarTexto}
            onPress={() => navigateTo("principalDron")}
          />
        )}

        {/* MOVILIDAD URBANA */}
        {(userRolId === 5 || userRolId === 1) && (
          <MenuOption
            icon="car-sport-outline"
            label="Movilidad Urbana"
            isActive={activeRoute === "principalmovilidad"}
            isExpanded={mostrarTexto}
            onPress={() => navigateTo("principalmovilidad")}
          />
        )}

        {/* SECCIONES ADMINISTRATIVAS */}
        {userRolId === 1 && isWeb && (
          <>
            <CollapsibleSection
              label="SEGURIDAD"
              icon="lock-closed-outline"
              isExpanded={mostrarTexto}
              isOpen={openSection === "SEGURIDAD"}
              onToggle={() => handleToggleSection("SEGURIDAD")}
            >
              <MenuOption
                icon="shield-checkmark-outline"
                label="Roles"
                isActive={activeRoute === "roles"}
                isExpanded={true}
                onPress={() => navigateTo("roles")}
                isSubItem
              />

              <MenuOption
                icon="key-outline"
                label="Permisos"
                isActive={activeRoute === "permisos"}
                isExpanded={true}
                onPress={() => navigateTo("permisos")}
                isSubItem
              />
            </CollapsibleSection>

            <CollapsibleSection
              label="PRUEBA"
              icon="flask-outline"
              isExpanded={mostrarTexto}
              isOpen={openSection === "Prueba"}
              onToggle={() => handleToggleSection("Prueba")}
            >
              <MenuOption
                icon="location-outline"
                label="oc"
                isActive={activeRoute === "oc"}
                isExpanded={true}
                onPress={() => navigateTo("oc")}
                isSubItem
              />

              <MenuOption
                icon="pie-chart-outline"
                label="Dashboard"
                isActive={activeRoute === "dashboard"}
                isExpanded={true}
                onPress={() => navigateTo("dashboard")}
                isSubItem
              />
            </CollapsibleSection>

            <CollapsibleSection
              label="GESTIÓN DE PERSONAL"
              icon="people-outline"
              isExpanded={mostrarTexto}
              isOpen={openSection === "PERSONAL"}
              onToggle={() => handleToggleSection("PERSONAL")}
            >
              <MenuOption
                icon="person-outline"
                label="Personas"
                isActive={activeRoute === "persona"}
                isExpanded={true}
                onPress={() => navigateTo("persona")}
                isSubItem
              />

              <MenuOption
                icon="business-outline"
                label="Unidades"
                isActive={activeRoute === "ocurrencias"}
                isExpanded={true}
                onPress={() => navigateTo("ocurrencias")}
                isSubItem
              />

              <MenuOption
                icon="git-network-outline"
                label="Puntos"
                isActive={activeRoute === "puntost"}
                isExpanded={true}
                onPress={() => navigateTo("puntost")}
                isSubItem
              />

              <MenuOption
                icon="layers-outline"
                label="Grupos"
                isActive={activeRoute === "grupos"}
                isExpanded={true}
                onPress={() => navigateTo("grupos")}
                isSubItem
              />
            </CollapsibleSection>

            <CollapsibleSection
              label="HORARIOS Y TURNOS"
              icon="time-outline"
              isExpanded={mostrarTexto}
              isOpen={openSection === "HORARIOS"}
              onToggle={() => handleToggleSection("HORARIOS")}
            >
              <MenuOption
                icon="list-outline"
                label="Jornada V."
                isActive={activeRoute === "jv"}
                isExpanded={true}
                onPress={() => navigateTo("jv")}
                isSubItem
              />

              <MenuOption
                icon="calendar-outline"
                label="PNP"
                isActive={activeRoute === "pnp"}
                isExpanded={true}
                onPress={() => navigateTo("pnp")}
                isSubItem
              />

              <MenuOption
                icon="walk-outline"
                label="Registro OC"
                isActive={activeRoute === "ocregistro"}
                isExpanded={true}
                onPress={() => navigateTo("ocregistro")}
                isSubItem
              />

              <MenuOption
                icon="document-text-outline"
                label="Licencias"
                isActive={activeRoute === "licencias"}
                isExpanded={true}
                onPress={() => navigateTo("licencias")}
                isSubItem
              />
            </CollapsibleSection>

            <CollapsibleSection
              label="OCURRENCIAS"
              icon="alert-circle-outline"
              isExpanded={mostrarTexto}
              isOpen={openSection === "OCURRENCIAS"}
              onToggle={() => handleToggleSection("OCURRENCIAS")}
            >
              <MenuOption
                icon="create-outline"
                label="Registro"
                isActive={activeRoute === "ocurrencias"}
                isExpanded={true}
                onPress={() => navigateTo("ocurrencias")}
                isSubItem
              />

              <MenuOption
                icon="images-outline"
                label="Galería"
                isActive={activeRoute === "galeria"}
                isExpanded={true}
                onPress={() => navigateTo("galeria")}
                isSubItem
              />

              <MenuOption
                icon="pricetags-outline"
                label="Categorías"
                isActive={activeRoute === "categorias_incidentes"}
                isExpanded={true}
                onPress={() => navigateTo("categorias_incidentes")}
                isSubItem
              />

              <MenuOption
                icon="map-outline"
                label="Detalle Operativo"
                isActive={activeRoute === "detalle_operativo"}
                isExpanded={true}
                onPress={() => navigateTo("detalle_operativo")}
                isSubItem
              />
            </CollapsibleSection>

            <CollapsibleSection
              label="PRODUCCIÓN Y CAMPO"
              icon="bar-chart-outline"
              isExpanded={mostrarTexto}
              isOpen={openSection === "PRODUCCION"}
              onToggle={() => handleToggleSection("PRODUCCION")}
            >
              <MenuOption
                icon="construct-outline"
                label="Mapas"
                isActive={activeRoute === "mapa"}
                isExpanded={true}
                onPress={() => navigateTo("mapa")}
                isSubItem
              />

              <MenuOption
                icon="navigate-circle-outline"
                label="Puntos operativos"
                isActive={activeRoute === "puntos"}
                isExpanded={true}
                onPress={() => navigateTo("puntos")}
                isSubItem
              />

              <MenuOption
                icon="navigate-circle-outline"
                label="Puntos operativos (Campo)"
                isActive={activeRoute === "puntocam"}
                isExpanded={true}
                onPress={() => navigateTo("puntocam")}
                isSubItem
              />
            </CollapsibleSection>

            <CollapsibleSection
              label="ZONIFICACIÓN"
              icon="map-outline"
              isExpanded={mostrarTexto}
              isOpen={openSection === "ZONIFICACION"}
              onToggle={() => handleToggleSection("ZONIFICACION")}
            >
              <MenuOption
                icon="shield-outline"
                label="Jurisdicción Serenazgo"
                isActive={activeRoute === "jurisdiccion_serenazgo"}
                isExpanded={true}
                onPress={() => navigateTo("jurisdiccion_serenazgo")}
                isSubItem
              />

              <MenuOption
                icon="ribbon-outline"
                label="Jurisdicción PNP"
                isActive={activeRoute === "jurisdiccion_pnp"}
                isExpanded={true}
                onPress={() => navigateTo("jurisdiccion_pnp")}
                isSubItem
              />
            </CollapsibleSection>

            <CollapsibleSection
              label="LUGAR"
              icon="location-outline"
              isExpanded={mostrarTexto}
              isOpen={openSection === "LUGAR"}
              onToggle={() => handleToggleSection("LUGAR")}
            >
              <MenuOption
                icon="location-outline"
                label="Vía"
                isActive={activeRoute === "via"}
                isExpanded={true}
                onPress={() => navigateTo("via")}
                isSubItem
              />

              <MenuOption
                icon="location-outline"
                label="Lugar"
                isActive={activeRoute === "lugar"}
                isExpanded={true}
                onPress={() => navigateTo("lugar")}
                isSubItem
              />
            </CollapsibleSection>

            <CollapsibleSection
              label="POR MODALIDADES"
              icon="albums-outline"
              isExpanded={mostrarTexto}
              isOpen={openSection === "Por modalidades"}
              onToggle={() => handleToggleSection("Por modalidades")}
            >
              <MenuOption
                icon="book-outline"
                label="Cuadernos de control"
                isActive={activeRoute === "cuaderno"}
                isExpanded={true}
                onPress={() => navigateTo("cuaderno")}
                isSubItem
              />

              <MenuOption
                icon="locate-outline"
                label="Táctico Priorizado"
                isActive={activeRoute === "tactp"}
                isExpanded={true}
                onPress={() => navigateTo("tactp")}
                isSubItem
              />

              <MenuOption
                icon="school-outline"
                label="Escuela Segura"
                isActive={activeRoute === "escseg"}
                isExpanded={true}
                onPress={() => navigateTo("escseg")}
                isSubItem
              />
            </CollapsibleSection>
          </>
        )}

        {/* CERRAR SESIÓN */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={handleLogout}
        >
          <View style={styles.iconBox}>
            <Ionicons
              name="log-out-outline"
              size={20}
              color="white"
            />
          </View>

          {mostrarTexto && (
            <Text style={styles.menuText}>Cerrar Sesión</Text>
          )}
        </TouchableOpacity>
      </DrawerContentScrollView>
    </View>
  );
};

const MenuOption = memo(
  ({ icon, label, isExpanded, onPress, isActive, isSubItem }: any) => {
    const validIcon =
      icon && Ionicons.glyphMap[icon as keyof typeof Ionicons.glyphMap]
        ? icon
        : "ellipse-outline";

    return (
      <TouchableOpacity
        style={[
          styles.menuItem,
          isSubItem && styles.subMenuItem,
          isActive && styles.activeBackground,
        ]}
        onPress={onPress}
      >
        {isActive && <View style={styles.glowBar} />}

        <View style={styles.iconBox}>
          <Ionicons
            name={validIcon as any}
            size={20}
            color="white"
          />
        </View>

        {isExpanded && (
          <Text style={[styles.menuText, isActive && styles.activeTextGlow]}>
            {label}
          </Text>
        )}
      </TouchableOpacity>
    );
  }
);

const CollapsibleSection = memo(
  ({ icon, label, isExpanded, children, isOpen, onToggle }: any) => {
    const validIcon =
      icon && Ionicons.glyphMap[icon as keyof typeof Ionicons.glyphMap]
        ? icon
        : "folder-outline";

    return (
      <View style={styles.sectionContainer}>
        <TouchableOpacity
          onPress={onToggle}
          style={styles.sectionHeader}
        >
          <View style={styles.iconBox}>
            <Ionicons
              name={validIcon as any}
              size={18}
              color="rgba(255,255,255,0.75)"
            />
          </View>

          {isExpanded && (
            <>
              <Text
                style={[
                  styles.sectionHeaderText,
                  { flex: 1, marginLeft: 5 },
                ]}
              >
                {label}
              </Text>

              <Ionicons
                name={isOpen ? "chevron-up" : "chevron-down"}
                size={14}
                color="rgba(255,255,255,0.6)"
              />
            </>
          )}
        </TouchableOpacity>

        {isOpen && <View>{children}</View>}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
    backgroundColor: "#004481",
  },
  sidebarHeader: {
    padding: 20,
    paddingTop: 30,
    alignItems: "center",
    flexDirection: "row",
  },
  avatarLarge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  subMenuItem: {
    paddingLeft: 36,
  },
  avatarLargeText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  userInfo: {
    marginLeft: 15,
    flex: 1,
  },
  userName: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  userRole: {
    color: "#75aaf0",
    fontSize: 11,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginVertical: 10,
    width: "90%",
    alignSelf: "center",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    paddingHorizontal: 15,
    position: "relative",
  },
  iconBox: {
    width: 40,
    alignItems: "center",
  },
  menuText: {
    color: "#fff",
    fontSize: 14,
    marginLeft: 5,
  },
  activeBackground: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  activeTextGlow: {
    fontWeight: "bold",
    color: "#fff",
  },
  glowBar: {
    position: "absolute",
    left: 0,
    height: "60%",
    width: 4,
    backgroundColor: "#38bdf8",
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  sectionContainer: {
    marginVertical: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 15,
  },
  sectionHeaderText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 15,
  },
});
