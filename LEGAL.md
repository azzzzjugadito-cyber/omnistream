# Encuadre Jurídico y Régimen de Responsabilidad de Intermediarios (TFG)

## 1. Contexto Académico y Naturaleza del Proyecto

El presente proyecto ha sido desarrollado con **fines estrictamente académicos y de investigación técnica** en el marco de un Trabajo de Fin de Grado (TFG) en Ingeniería de Telecomunicación / Informática.

La hipótesis investigadora radica en determinar la viabilidad de una **arquitectura de software agnóstica para la agregación multimedia unificada**, evaluando protocolos de streaming estándar (HLS, MPEG-TS, MP4), patrones de diseño de software (Adaptador, Proxy inverso, Health-checking) y técnicas de indexación distribuida.

---

## 2. Doctrina Jurídica sobre Enlaces y Comunicación Pública

Desde la perspectiva jurídica aplicable en la Unión Europea y en España, el software implementado se rige por los siguientes principios:

### A. Ausencia de Alojamiento y Retransmisión Propia
- **OmniStream OTT no almacena, no transcodifica, no redistribuye ni aloja contenido audiovisual alguno** en sus servidores.
- La aplicación se comporta de manera análoga a un **navegador web o cliente multimedia** (como VLC, Safari o Google Chrome): procesa punteros de red (URLs públicas) y delega la descarga y decodificación de paquetes en el motor HLS del cliente.

### B. Jurisprudencia del Tribunal de Justicia de la Unión Europea (TJUE)
1. **Sentencia Svensson (Asunto C-466/12)**:
   El TJUE determinó que la inserción de hiperenlaces que dirigen a obras accesibles de manera libre en otro sitio web no constituye un acto de «comunicación al público» en el sentido del artículo 3, apartado 1, de la Directiva 2001/29/CE, por cuanto el acto no se dirige a un «público nuevo» que no hubiera sido ya tomado en consideración por los titulares originarios al autorizar la comunicación inicial en abierto.
2. **Sentencia GS Media (Asunto C-160/15)** y **Filmspeler (Asunto C-527/15)**:
   Se matiza la doctrina para supuestos con ánimo de lucro directo o dispositivos preconfigurados con enlaces manifiestamente ilegales. En este proyecto académico:
   - **No existe contraprestación económica, publicidad ni modelo comercial alguno.**
   - Las fuentes de datos de referencia suministradas son **emisiones oficiales en abierto** de la Televisión Digital Terrestre (TDTChannels, RTVE, autonómicas) y catálogos de **dominio público / licencias Creative Commons** (Blender Open Movies, Sintel, Big Buck Bunny).

### C. Régimen de Exención de Responsabilidad (LSSI-CE y Directiva 2000/31/CE)
De conformidad con los artículos 16 y 17 de la **Ley 34/2002 (LSSI-CE)** y la Directiva de Comercio Electrónico de la UE:
- Los prestadores de servicios de intermediación que faciliten enlaces o herramientas de búsqueda no responden por la información a la que remitan si no tienen conocimiento efectivo de que la actividad o la información es ilícita.
- El archivo `sources.yaml` es completamente editable por el usuario final bajo su exclusiva responsabilidad, permitiendo retirar o añadir proveedores sin intervención del desarrollador del software.

---

## 3. Descargo de Responsabilidad (Disclaimer)

1. El autor de este trabajo no se responsabiliza del uso indebido que terceros puedan dar al código fuente ni de la incorporación de enlaces privados o protegidos por derechos de propiedad intelectual en el archivo de configuración personal `sources.yaml`.
2. Las marcas comerciales, logotipos, nombres de ligas (LaLiga, Premier League, NBA, UFC, F1) y nombres de canales mencionados en la aplicación pertenecen a sus respectivos propietarios y se utilizan exclusivamente con fines de referencia técnica y nominativa.
3. Se recomienda a cualquier usuario o evaluador del sistema verificar la legitimidad de las transmisiones en su jurisdicción antes de sintonizar flujos procedentes de terceros.
