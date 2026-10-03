import { StyleSheet } from 'react-native';

const MJM_BLUE = '#0052CC'; 

const styles = StyleSheet.create({
    // ==========================================
    // CONTENEDORES PRINCIPALES Y ESTRUCTURA
    // ==========================================
    main: { 
        flex: 1, 
        backgroundColor: '#FFFFFF', 
    },
    scroll: { 
        paddingHorizontal: 15, 
        paddingBottom: 100 
    },

    // ==========================================
    // TARJETAS (CARDS) Y SECCIONES
    // ==========================================
    sectionTitle: { 
        fontSize: 14, 
        fontWeight: 'bold', 
        color: MJM_BLUE, 
        marginBottom: 15, 
        textAlign: 'center',
        marginTop: 10
    },
    card: { 
        backgroundColor: '#FFFFFF', 
        padding: 18, 
        borderRadius: 15, 
        borderWidth: 1,
        borderColor: '#EFEFEF',
    },

    // ==========================================
    // FORMULARIOS, INPUTS Y TEXTAREAS
    // ==========================================
    label: { 
        fontSize: 11, 
        fontWeight: 'bold', 
        marginTop: 15, 
        color: '#444' 
    },
    textInput: {
        borderWidth: 1.5,
        borderColor: '#eee',
        height: 45,
        marginTop: 5,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: 'white',
        color: 'black',
    },
    textArea: { 
        borderWidth: 1.5, 
        borderColor: '#eee', 
        height: 100, 
        marginTop: 5, 
        padding: 12, 
        borderRadius: 10, 
        textAlignVertical: 'top', 
        backgroundColor: 'white',
        color: 'black',
    },

    // ==========================================
    // LISTADO DE UNIDADES Y CHIPS INTERACTIVOS
    // ==========================================
    listadoUnidadesContainer: {
        marginTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
        paddingTop: 15,
    },
    listadoHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    listadoTitle: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#888',
        letterSpacing: 1,
    },
    btnAddUnit: { 
        backgroundColor: MJM_BLUE, 
        padding: 10, 
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center'
    },
    chipsWrapper: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 5,
    },
    unitChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: MJM_BLUE,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
    },
    unitChipText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },

    // ==========================================
    // BOTÓN DE ACCIÓN / GUARDADO PRINCIPAL
    // ==========================================
    btnSave: { 
        backgroundColor: '#28a745', 
        padding: 15, 
        borderRadius: 12, 
        marginTop: 20, 
        alignItems: 'center', 
        width: '100%' 
    },

    // ==========================================
    // MODALES Y PROGRESO (OVERLAYS)
    // ==========================================
    modalOverlay: { 
        flex: 1, 
        backgroundColor: 'rgba(0,0,0,0.5)', 
        justifyContent: 'center', 
        alignItems: 'center' 
    },
    modalContent: { 
        backgroundColor: '#FFFFFF', 
        padding: 25, 
        borderRadius: 20, 
        alignItems: 'center', 
        width: '85%',
        elevation: 10,           
        shadowColor: '#000',     
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        marginBottom: 15,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: MJM_BLUE,
    },
    modalLabelInput: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#444',
        alignSelf: 'flex-start',
        marginTop: 12,
    },
    checkItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 5,
        width: '100%',
        borderBottomWidth: 1,
        borderBottomColor: '#f5f5f5',
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
        marginTop: 20,
        justifyContent: 'space-between'
    },
    modalBtn: {
        flex: 1,
        height: 45,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#eee',
        backgroundColor: 'white',
    },
    modalBtnPrimary: {
        backgroundColor: MJM_BLUE,
        borderColor: MJM_BLUE,
    },
    modalBtnText: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#444',
    },
    modalBtnTextPrimary: {
        color: 'white',
    },
});

export default styles;