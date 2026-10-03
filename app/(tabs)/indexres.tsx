
/* jemplo para bd 

const getFiltroDinamico = (req) => {
  const { id_origen, id_tipop } = req.query;

  const ahora = new Date();
  const horaActual = ahora.getHours();
  const minutosActuales = ahora.getMinutes();
  const tiempoMinutos = horaActual * 60 + minutosActuales;

  let filtro = "";
  let params = [];

  // Definimos los rangos exactos según el turno actual
  if (tiempoMinutos >= 430 && tiempoMinutos < 900) {
    // Turno Mañana (07:00 - 15:00) del día actual
    filtro = `WHERE o.fecha_evento = CURDATE() AND o.hora_repliegue >= '07:00:00' AND o.hora_repliegue < '15:00:00'`;
  } else if (tiempoMinutos >= 900 && tiempoMinutos < 1320) {
    // Turno Tarde (15:00 - 22:00) del día actual
    filtro = `WHERE o.fecha_evento = CURDATE() AND o.hora_repliegue >= '15:00:00' AND o.hora_repliegue < '22:00:00'`;
  } else {
    // Turno Noche (22:00 de ayer a 07:00 de hoy)
    filtro = `
      WHERE (
        (o.fecha_evento = DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND o.hora_repliegue >= '22:00:00')
        OR 
        (o.fecha_evento = CURDATE() AND o.hora_repliegue <= '07:00:00')
      )
    `;
  }

  // Aseguramos que no traiga eventos del futuro en la hora actual
  filtro += ` AND TIMESTAMP(o.fecha_evento, o.hora_repliegue) <= NOW()`;

  // Añadir filtros adicionales de catálogos si existen
  if (id_origen && id_origen !== 'TODOS') {
    filtro += ` AND o.id_origen = ? `;
    params.push(id_origen);
  }

  if (id_tipop && id_tipop !== 'TODOS') {
    filtro += ` AND o.id_tipop = ? `;
    params.push(id_tipop);
  }

  return { filtro, params };
};

// 0. ENDPOINT DE CATÁLOGOS PARA LOS BADGES
app.get("/ocurrencias/catalogos-filtros", async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    const [origenes] = await connection.query("SELECT id_origen, descripcion FROM origen");
    const [tiposPatrullaje] = await connection.query("SELECT id_tipop, nombre FROM tipo_patrullaje");
    
    res.json({
      success: true,
      origenes,
      tipos_patrullaje: tiposPatrullaje
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// 1. ENDPOINT ESTADÍSTICAS (Con soporte para filtros de badges y turno)
app.get("/ocurrencias/estadisticas", async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    const { filtro, params } = getFiltroDinamico(req);

    const sqlUsuarios = `
      SELECT 
        us.id_usuario AS id,
        COALESCE(CONCAT(p.apellido_paterno, ' ', p.apellido_materno, ', ', p.nombres), 'Sin asignar') AS label,
        COUNT(o.id_ocurrencia) AS value
      FROM ocurrencia_registro o
      LEFT JOIN usuarios_sistema us ON o.id_usuario = us.id_usuario 
      LEFT JOIN persona p ON us.id_persona = p.id_persona
      ${filtro}
      GROUP BY us.id_usuario, p.apellido_paterno, p.apellido_materno, p.nombres
      ORDER BY value DESC;
    `;

    const sqlModalidades = `
      SELECT 
        COALESCE(m.nombre, 'Sin modalidad') AS label,
        COUNT(o.id_ocurrencia) AS value
      FROM ocurrencia_registro o
      LEFT JOIN cat_modalidad m ON o.id_modalidad = m.id
      ${filtro}
      GROUP BY m.id, m.nombre
      ORDER BY value DESC;
    `;

    const [usuariosRows] = await connection.query(sqlUsuarios, params);
    const [modalidadesRows] = await connection.query(sqlModalidades, params);

    res.json({
      success: true,
      por_usuario: usuariosRows,
      por_modalidad: modalidadesRows,
    });
  } catch (error) {
    console.error("ERROR EN /ocurrencias/estadisticas:", error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// 2. ENDPOINT MODALIDADES POR USUARIO
app.get("/ocurrencias/modalidades-por-usuario", async (req, res) => {
  const { id_usuario } = req.query; 

  if (!id_usuario) {
    return res.status(400).json({ success: false, error: "El parámetro id_usuario es obligatorio" });
  }

  let connection;
  try {
    connection = await db.getConnection();
    const { filtro, params } = getFiltroDinamico(req);

    const sqlModalidadesUsuario = `
      SELECT 
        COALESCE(m.nombre, 'Sin modalidad') AS modalidad,
        COUNT(o.id_ocurrencia) AS cantidad
      FROM ocurrencia_registro o
      LEFT JOIN cat_modalidad m ON o.id_modalidad = m.id
      ${filtro}
      AND o.id_usuario = ?
      GROUP BY m.id, m.nombre
      ORDER BY cantidad DESC;
    `;

    // Añadimos el id_usuario al final de los parámetros
    const [modalidadesRows] = await connection.query(sqlModalidadesUsuario, [...params, id_usuario]);

    res.json({ success: true, modalidades: modalidadesRows });
  } catch (error) {
    console.error("ERROR EN /ocurrencias/modalidades-por-usuario:", error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// 3. ENDPOINT DETALLE POR MODALIDAD
app.get("/ocurrencias/detalle-por-modalidad", async (req, res) => {
  const { id_usuario, modalidad } = req.query;

  if (!id_usuario || !modalidad) {
    return res.status(400).json({ success: false, error: "Los parámetros son obligatorios" });
  }

  let connection;
  try {
    connection = await db.getConnection();
    const { filtro, params } = getFiltroDinamico(req);

    const sqlDetalleDirecciones = `
      SELECT 
        COALESCE(m.nombre, 'Sin modalidad') AS MODALIDAD, 
        COALESCE(TRIM(l.nombre_lugar), 'Sin dirección registrada') AS DIRECCIÓN_CONSOLIDADA,
        COUNT(o.id_ocurrencia) AS CANTIDAD
      FROM ocurrencia_registro o 
      INNER JOIN origen ori ON o.id_origen = ori.id_origen 
      LEFT JOIN lugar l ON o.id_lugar = l.id_lugar 
      LEFT JOIN cat_modalidad m ON o.id_modalidad = m.id
      ${filtro}
      AND o.id_usuario = ?
      AND (
        TRIM(m.nombre) = TRIM(?) OR (? = 'Sin modalidad' AND m.nombre IS NULL)
      )
      GROUP BY COALESCE(TRIM(l.nombre_lugar), 'Sin dirección registrada'), m.nombre
      ORDER BY CANTIDAD DESC;
    `;

    const [detalleRows] = await connection.query(sqlDetalleDirecciones, [
      ...params,
      id_usuario, 
      modalidad, 
      modalidad
    ]);

    res.json({ success: true, direcciones: detalleRows });
  } catch (error) {
    console.error("ERROR EN /ocurrencias/detalle-por-modalidad:", error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) connection.release();
  }
});
app.get("/ocurrencias/estadisticas-mensuales", async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();

    const mes = req.query.mes || new Date().getMonth() + 1;
    const anio = req.query.anio || new Date().getFullYear();
    const idModalidad = req.query.id_modalidad;

    // Filtros basados en fecharm (Fecha administrativa del trigger)
    let whereClause = `WHERE MONTH(o.fecharm) = ? AND YEAR(o.fecharm) = ?`;
    let queryParams = [mes, anio];

    if (idModalidad) {
      whereClause += ` AND o.id_modalidad = ?`;
      queryParams.push(idModalidad);
    }

    // 1. Evolución diaria desglosada por turno (para el gráfico apilado/colores)
    const sqlDiarioTurnos = `
      SELECT 
        DAY(o.fecharm) AS dia,
        o.turnrm AS turno,
        COUNT(o.id_ocurrencia) AS total
      FROM ocurrencia_registro o
      ${whereClause} AND o.turnrm IN ('M', 'T', 'N')
      GROUP BY DAY(o.fecharm), o.turnrm
      ORDER BY dia ASC;
    `;

    // 2. Matriz de usuarios agrupada por fecharm y turno
    const sqlMatrizUsuarios = `
      SELECT 
        COALESCE(CONCAT(p.apellido_paterno, ' ', p.apellido_materno, ', ', p.nombres), 'Sin asignar') AS usuario,
        DAY(o.fecharm) AS dia,
        o.turnrm AS turno,
        COUNT(o.id_ocurrencia) AS total
      FROM ocurrencia_registro o
      LEFT JOIN usuarios_sistema us ON o.id_usuario = us.id_usuario 
      LEFT JOIN persona p ON us.id_persona = p.id_persona
      ${whereClause}
      GROUP BY us.id_usuario, p.apellido_paterno, p.apellido_materno, p.nombres, DAY(o.fecharm), o.turnrm
      ORDER BY usuario ASC;
    `;

    // 3. Totales generales del mes (Total mes y total por turno general)
    const sqlTotalesMes = `
      SELECT 
        COUNT(o.id_ocurrencia) AS total_mes,
        SUM(CASE WHEN o.turnrm = 'M' THEN 1 ELSE 0 END) AS total_mañana,
        SUM(CASE WHEN o.turnrm = 'T' THEN 1 ELSE 0 END) AS total_tarde,
        SUM(CASE WHEN o.turnrm = 'N' THEN 1 ELSE 0 END) AS total_noche
      FROM ocurrencia_registro o
      ${whereClause};
    `;

    const [modalidadesRows] = await connection.query(`SELECT id, nombre FROM cat_modalidad ORDER BY nombre ASC`);
    const [diarioRows] = await connection.query(sqlDiarioTurnos, queryParams);
    const [matrizRows] = await connection.query(sqlMatrizUsuarios, queryParams);
    const [totalesRows] = await connection.query(sqlTotalesMes, queryParams);

    res.json({
      success: true,
      evolucion_diaria_turnos: diarioRows,
      matriz_usuarios: matrizRows,
      totales_mes: totalesRows[0] || { total_mes: 0, total_mañana: 0, total_tarde: 0, total_noche: 0 },
      modalidades_catalogo: modalidadesRows,
    });
  } catch (error) {
    console.error("ERROR EN /ocurrencias/estadisticas-mensuales:", error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (connection) connection.release();
  }
});
*/