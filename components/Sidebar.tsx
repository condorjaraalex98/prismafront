import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { DrawerContentScrollView } from "expo-router/drawer";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  useWindowDimensions,
  View,
} from "react-native";
import { useAuth } from "../context/userContext";



export const Sidebar = (props: any) => {
  const { userData, logout, loading } = useAuth();
  const [isReady, setIsReady] = useState(false);

  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isWeb = !isMobile;
  const activeRoute = props.state?.routes[props.state.index]?.name;
  const [openSection, setOpenSection] = useState<string | null>(null);
  const userRolId = userData?.id_rol ? Number(userData.id_rol) : null;

  // Evita el error "Can't perform a React state update..."
  useEffect(() => {
    if (!loading) {
      setIsReady(true);
    }
  }, [loading]);

  if (loading || !isReady) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  const { isExpanded } = props;
// ✅ CÓDIGO NUEVO
const handleToggleSection = (sectionLabel: string) => {
  setOpenSection(openSection === sectionLabel ? null : sectionLabel);
};

  const navigateTo = (route: string) => {
    if (isMobile) {
      props.navigation.closeDrawer();
      requestAnimationFrame(() => {
        router.push(`/${route}` as any);
      });
    } else {
      router.push(`/${route}` as any);
    }
  };

  return (
    <View style={styles.container}>
      <DrawerContentScrollView {...props} showsVerticalScrollIndicator={false}>
        {/* Header */}
        {(isExpanded || isMobile) && (
          <View style={styles.sidebarHeader}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarLargeText}>
                {userData?.nombres ? userData.nombres[0].toUpperCase() : "U"}
              </Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>
                {userData?.nombres} {userData?.apellido_paterno}
              </Text>
              <Text style={styles.userRole}>{userData?.rol || "Usuario"}</Text>
            </View>
          </View>
        )}

        <View style={styles.divider} />
        {(userRolId === 3 || userRolId === 1) && !isWeb && (

<MenuOption
          icon="home-outline"
              label="Principal"
              isActive={activeRoute === "principal"}
              isExpanded={true}
              onPress={() => navigateTo("principal")}
              isSubItem
            />
 )}

 {(userRolId === 3 || userRolId === 1) && isWeb && (

<MenuOption
             icon="home-outline"
              label="Principal"
              isActive={activeRoute === "cecomdoceh"}
              isExpanded={true}
              onPress={() => navigateTo("cecomdoceh")}
              isSubItem
            />
 )}

       
   {(userRolId === 3 || userRolId === 1) && !isWeb && (
  <>
    {/* Primer Collapsible: RANKING (Celular o Web según necesites) */}
    <CollapsibleSection
      icon="location-outline"
      label="RANKING"
      isExpanded={isExpanded || isMobile}
      isOpen={openSection === "Ranking"}
      onToggle={() => handleToggleSection("Ranking")}
    >
      <MenuOption
        icon="stats-chart-outline"
        label="Estadística CAMPO"
        isActive={activeRoute === "rcampo"}
        isExpanded={true}
        onPress={() => navigateTo("rcampo")}
        isSubItem
      />
    </CollapsibleSection>

    {/* Segundo Collapsible: PRINCIPAL / INICIO */}
    <CollapsibleSection
      icon="home-outline"
      label="OTROS"
      isExpanded={isExpanded || isMobile}
      isOpen={openSection === "Principal"}
      onToggle={() => handleToggleSection("Principal")}
    >
      <MenuOption
        icon="map-outline"
        label="Mapas"
        isActive={activeRoute === "mapa"}
        isExpanded={true}
        onPress={() => navigateTo("mapa")}
        isSubItem
      />

       <MenuOption
        icon="pin-outline"
        label="Puntos"
        isActive={activeRoute === "puntos"}
        isExpanded={true}
        onPress={() => navigateTo("puntos")}
        isSubItem
      />
    </CollapsibleSection>
  </>
)}


        {(userRolId === 3 || userRolId === 1) && isWeb && (
  <>
    {/* Primer Collapsible: RANKING (Celular o Web según necesites) */}
    <CollapsibleSection
      icon="location-outline"
      label="RANKING"
      isExpanded={isExpanded || isMobile}
      isOpen={openSection === "Ranking"}
      onToggle={() => handleToggleSection("Ranking")}
    >
      <MenuOption
        icon="stats-chart-outline"
        label="Estadística CECOM"
        isActive={activeRoute === "rcecom"}
        isExpanded={true}
        onPress={() => navigateTo("rcecom")}
        isSubItem
      />
    </CollapsibleSection>

    {/* Segundo Collapsible: PRINCIPAL / INICIO */}
    <CollapsibleSection
      icon="home-outline"
      label="OTROS"
      isExpanded={isExpanded || isMobile}
      isOpen={openSection === "Principal"}
      onToggle={() => handleToggleSection("Principal")}
    >
      <MenuOption
        icon="map-outline"
        label="Mapas"
        isActive={activeRoute === "mapa"}
        isExpanded={true}
        onPress={() => navigateTo("mapa")}
        isSubItem
      />

       <MenuOption
        icon="pin-outline"
        label="Puntos"
        isActive={activeRoute === "puntos"}
        isExpanded={true}
        onPress={() => navigateTo("puntos")}
        isSubItem
      />
    </CollapsibleSection>
  </>
)}








        {(userRolId === 4 || userRolId === 1) && (
          <CollapsibleSection
            label="MANTENIMIENTO1"
            icon="location-outline"
            isExpanded={isExpanded || isMobile}
            isOpen={openSection === "Mantenimiento"}
            onToggle={() => handleToggleSection("Mantenimiento")}
          >
            <MenuOption
              icon="location-outline"
              label="Usuario"
              isActive={activeRoute === "usuario"}
              isExpanded={true}
              onPress={() => navigateTo("usuario")}
              isSubItem
            />
            <MenuOption
              icon="location-outline"
              label="Contraseña"
              isActive={activeRoute === "rolpersona"}
              isExpanded={true}
              onPress={() => navigateTo("rolpersona")}
              isSubItem
            />
            <MenuOption
              icon="map-outline"
              label="PNP"
              isActive={activeRoute === "crudpnp"}
              isExpanded={true}
              onPress={() => navigateTo("crudpnp")}
              isSubItem
            />
            <MenuOption
              icon="map-outline"
              label="UNIDADES"
              isActive={activeRoute === "crudunidades"}
              isExpanded={true}
              onPress={() => navigateTo("crudunidades")}
              isSubItem
            />
            <MenuOption
              icon="map-outline"
              label="LUGAR"
              isActive={activeRoute === "crudlugar"}
              isExpanded={true}
              onPress={() => navigateTo("crudlugar")}
              isSubItem
            />
          </CollapsibleSection>
        )}

        {(userRolId === 1) && isWeb && (
          <CollapsibleSection
            label="PATRULLAJE TECNOLÓGICO"
            icon="location-outline"
            isExpanded={isExpanded || isMobile}
            isOpen={openSection === "Patrullaje Tecnológico"}
            onToggle={() => handleToggleSection("Patrullaje Tecnológico")}
          >
            <MenuOption
              icon="play-circle-outline"
              label="Inicio de Servicio"
              isActive={activeRoute === "iniciocecom"}
              isExpanded={true}
              onPress={() => navigateTo("iniciocecom")}
              isSubItem
            />
            <MenuOption
              icon="location-outline"
              label="cecom"
              isActive={activeRoute === "cecom"}
              isExpanded={true}
              onPress={() => navigateTo("cecom")}
              isSubItem
            />
            <MenuOption
              icon="desktop-outline"
              label="Cecom 12 horas"
              isActive={activeRoute === "cecomdoceh"}
              isExpanded={true}
              onPress={() => navigateTo("cecomdoceh")}
              isSubItem
            />
            <MenuOption
              icon="radio-outline"
              label="Cecom 7 días"
              isActive={activeRoute === "principal"}
              isExpanded={true}
              onPress={() => navigateTo("principal")}
              isSubItem
            />
            <MenuOption
              icon="radio-outline"
              label="Record Cecom"
              isActive={activeRoute === "recordcecom"}
              isExpanded={true}
              onPress={() => navigateTo("recordcecom")}
              isSubItem
            />

             <MenuOption
              icon="radio-outline"
              label="DASH KILO"
              isActive={activeRoute === "cecomop"}
              isExpanded={true}
              onPress={() => navigateTo("cecomop")}
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

{(userRolId === 5 || userRolId === 1) &&  (
          <CollapsibleSection
            label="ESTADÍSTICA"
            icon="location-outline"
            isExpanded={isExpanded || isMobile}
            isOpen={openSection === "ESTADISTICA"}
            onToggle={() => handleToggleSection("ESTADISTICA")}
          >
            <MenuOption
              icon="location-outline"
              label="Registro"
              isActive={activeRoute === "estadis"}
              isExpanded={true}
              onPress={() => navigateTo("estadis")}
              isSubItem
            />
             <MenuOption
              icon="location-outline"
              label="Registro"
              isActive={activeRoute === "estadist"}
              isExpanded={true}
              onPress={() => navigateTo("estadist")}
              isSubItem
            />
          <MenuOption
              icon="location-outline"
              label="POI"
              isActive={activeRoute === "poi"}
              isExpanded={true}
              onPress={() => navigateTo("poi")}
              isSubItem
            />

             <MenuOption
              icon="location-outline"
              label="pruebau"
              isActive={activeRoute === "cecomsuper"}
              isExpanded={true}
              onPress={() => navigateTo("cecomsuper")}
              isSubItem
            />
          </CollapsibleSection>
        )}

        {(userRolId === 5 || userRolId === 1) && isWeb && (
          <CollapsibleSection
            label="SIPCOP"
            icon="location-outline"
            isExpanded={isExpanded || isMobile}
            isOpen={openSection === "SIPCOP"}
            onToggle={() => handleToggleSection("SIPCOP")}
          >
            <MenuOption
              icon="location-outline"
              label="Registro"
              isActive={activeRoute === "registros"}
              isExpanded={true}
              onPress={() => navigateTo("registros")}
              isSubItem
            />
            <MenuOption
              icon="location-outline"
              label="Sipcop"
              isActive={activeRoute === "sipcop"}
              isExpanded={true}
              onPress={() => navigateTo("sipcop")}
              isSubItem
            />
            <MenuOption
              icon="location-outline"
              label="Sipcop2"
              isActive={activeRoute === "sipcopd"}
              isExpanded={true}
              onPress={() => navigateTo("sipcopd")}
              isSubItem
            />
          </CollapsibleSection>
        )}

        {(userRolId === 5 || userRolId === 1) && isWeb && (
          <CollapsibleSection
            label="EXPORTAR"
            icon="location-outline"
            isExpanded={isExpanded || isMobile}
            isOpen={openSection === "EXPORTAR"}
            onToggle={() => handleToggleSection("EXPORTAR")}
          >
            <MenuOption
              icon="location-outline"
              label="Exportar"
              isActive={activeRoute === "exportar"}
              isExpanded={true}
              onPress={() => navigateTo("exportar")}
              isSubItem
            />
            <MenuOption
              icon="location-outline"
              label="Exportar Rango"
              isActive={activeRoute === "exportarango"}
              isExpanded={true}
              onPress={() => navigateTo("exportarango")}
              isSubItem
            />
          </CollapsibleSection>
        )}

        {(userRolId === 5 || userRolId === 1) && isWeb && (
          <CollapsibleSection
            label="POI"
            icon="location-outline"
            isExpanded={isExpanded || isMobile}
            isOpen={openSection === "POI"}
            onToggle={() => handleToggleSection("POI")}
          >
            <MenuOption
              icon="location-outline"
              label="POI"
              isActive={activeRoute === "poi"}
              isExpanded={true}
              onPress={() => navigateTo("poi")}
              isSubItem
            />

            <MenuOption
              icon="location-outline"
              label="POI CECOM"
              isActive={activeRoute === "poicecom"}
              isExpanded={true}
              onPress={() => navigateTo("poicecom")}
              isSubItem
            />

            <MenuOption
              icon="location-outline"
              label="POI CECOM"
              isActive={activeRoute === "poicecom2"}
              isExpanded={true}
              onPress={() => navigateTo("poicecom2")}
              isSubItem
            />
          </CollapsibleSection>
        )}

        {(userRolId === 4 || userRolId === 1) && isWeb && (
          <CollapsibleSection
            label="DRONES"
            icon="location-outline"
            isExpanded={isExpanded || isMobile}
            isOpen={openSection === "Drones"}
            onToggle={() => handleToggleSection("Drones")}
          >
            <MenuOption
              icon="navigate-outline"
              label="Drones"
              isActive={activeRoute === "principalDron"}
              isExpanded={true}
              onPress={() => navigateTo("principalDron")}
              isSubItem
            />
          </CollapsibleSection>
        )}

        {(userRolId === 5 || userRolId === 1) && isWeb && (
          <CollapsibleSection
            label="MOVILIDAD"
            icon="location-outline"
            isExpanded={isExpanded || isMobile}
            isOpen={openSection === "Movilidad Urbana"}
            onToggle={() => handleToggleSection("Movilidad Urbana")}
          >
            <MenuOption
              icon="navigate-outline"
              label="Movilidad Urbana"
              isActive={activeRoute === "principalmovilidad"}
              isExpanded={true}
              onPress={() => navigateTo("principalmovilidad")}
              isSubItem
            />
          </CollapsibleSection>
        )}

        {userRolId === 1 && isWeb && (
          <>
            <CollapsibleSection
              label="SEGURIDAD"
              icon="lock-closed-outline"
              isExpanded={isExpanded}
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
              label="MANTENIMIENTO"
              icon="settings-outline"
              isExpanded={isExpanded}
              isOpen={openSection === "AUDITORIA"}
              onToggle={() => handleToggleSection("AUDITORIA")}
            >
              <MenuOption
                icon="map-outline"
                label="Usuario"
                isActive={activeRoute === "usuario"}
                isExpanded={true}
                onPress={() => navigateTo("usuario")}
                isSubItem
              />
              <MenuOption
                icon="map-outline"
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
              <MenuOption
                icon="map-outline"
                label="PNP"
                isActive={activeRoute === "crudpnp"}
                isExpanded={true}
                onPress={() => navigateTo("crudpnp")}
                isSubItem
              />
            </CollapsibleSection>

            <CollapsibleSection
              label="PRUEBA"
              icon="flask-outline"
              isExpanded={isExpanded}
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
              isExpanded={isExpanded || isMobile}
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
                icon="person-outline"
                label="Usuario"
                isActive={activeRoute === "usuario"}
                isExpanded={true}
                onPress={() => navigateTo("usuario")}
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
              isExpanded={isExpanded || isMobile}
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
              isExpanded={isExpanded || isMobile}
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
              isExpanded={isExpanded || isMobile}
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
                label="Puntos operativos"
                isActive={activeRoute === "puntocam"}
                isExpanded={true}
                onPress={() => navigateTo("puntocam")}
                isSubItem
              />
            </CollapsibleSection>

            <CollapsibleSection
              label="ZONIFICACIÓN"
              icon="map-outline"
              isExpanded={isExpanded || isMobile}
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
              isExpanded={isExpanded || isMobile}
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
              label="Por modalidades"
              icon="location-outline"
              isExpanded={isExpanded || isMobile}
              isOpen={openSection === "Por modalidades"}
              onToggle={() => handleToggleSection("Por modalidades")}
            >
              <MenuOption
                icon="location-outline"
                label="Cuadernos de control"
                isActive={activeRoute === "cuaderno"}
                isExpanded={true}
                onPress={() => navigateTo("cuaderno")}
                isSubItem
              />
              <MenuOption
                icon="location-outline"
                label="Táctico Priorizado"
                isActive={activeRoute === "tactp"}
                isExpanded={true}
                onPress={() => navigateTo("tactp")}
                isSubItem
              />
              <MenuOption
                icon="pie-chart-outline"
                label="Escuela Segura"
                isActive={activeRoute === "escseg"}
                isExpanded={true}
                onPress={() => navigateTo("escseg")}
                isSubItem
              />
            </CollapsibleSection>
          </>
        )}

        {/* --- BOTÓN CERRAR SESIÓN --- */}
        <TouchableOpacity
          style={styles.menuItem}
          onPress={async () => {
            await logout();
            router.replace("/");
            if (Platform.OS === "web") {
              window.location.reload();
            }
          }}
        >
          <View style={styles.iconBox}>
            <Ionicons name="log-out-outline" size={20} color="white" />
          </View>
          <Text style={styles.menuText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </DrawerContentScrollView>
    </View>
  );
};

const MenuOption = ({
  icon,
  label,
  isExpanded,
  onPress,
  isActive,
  isSubItem,
}: any) => {
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
      <View style={styles.iconBox}>
        <Ionicons name={validIcon as any} size={20} color="white" />
      </View>
      {isExpanded && <Text style={styles.menuText}>{label}</Text>}
    </TouchableOpacity>
  );
};

const CollapsibleSection = ({
  label,
  children,
  isOpen,
  onToggle,
}: any) => (
  <View>
    <TouchableOpacity onPress={onToggle} style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{label}</Text>
    </TouchableOpacity>
    {isOpen && <View>{children}</View>}
  </View>
);


const styles = StyleSheet.create({

  loadingContainer: { justifyContent: "center", alignItems: "center" },
 
  container: { flex: 1, backgroundColor: "#004481" },
  
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
    paddingLeft: 36, // <--- Ajusta este valor (28, 36 o 40) según qué tan a la derecha los quieres
  },
  avatarLargeText: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  userInfo: { marginLeft: 15, flex: 1 },
  userName: { color: "#fff", fontSize: 14, fontWeight: "bold" },
  userRole: { color: "#75aaf0", fontSize: 11 },
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
  iconBox: { width: 40, alignItems: "center" },
  menuText: { color: "#fff", fontSize: 14, marginLeft: 5 },
  activeBackground: { backgroundColor: "rgba(255,255,255,0.1)" },
  activeTextGlow: { fontWeight: "bold", color: "#fff" },
  glowBar: {
    position: "absolute",
    left: 0,
    height: "60%",
    width: 4,
    backgroundColor: "#38bdf8",
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },

  
  sectionContainer: { marginVertical: 2 },
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
