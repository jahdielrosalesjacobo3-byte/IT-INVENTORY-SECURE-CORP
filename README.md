# IT-INVENTORY-SECURE-CORP

# Plantillas Word para documentos

Coloca aquí tus archivos **.docx** (por ejemplo `FormatoComputo.docx`).

## Cómo rellenar automáticamente

En el documento Word escribe **placeholders** entre llaves. El sistema los sustituirá por los datos reales.

### Datos de colaborador (por asignación / empleado)

| Placeholder   | Descripción        | Ejemplo    |
|---------------|--------------------|------------|
| `{nombre}`    | Nombre(s)          | Juan       |
| `{apellidos}` | Apellidos          | Pérez López|
| `{correo}`    | Correo corporativo | juan@...   |
| `{puesto}`    | Cargo / puesto     | Analista   |
| `{ticket}`    | Número de ticket   | 12345      |
| `{fecha}`     | Fecha actual       | 05/03/2025 |

### Equipos asignados (puedes usar listas)

Para **varias computadoras** en el mismo documento:

```
{#computadoras}
Marca: {marca} | Modelo: {modelo} | Serie: {serie}
{/computadoras}
```

Para **celulares**:

```
{#celulares}
Marca: {marca} | Modelo: {modelo} | Serie: {serie}
{/celulares}
```

Para **SIM cards**:

```
{#simcards}
Número: {numero_celular} | ICC: {icc} | IMEI: {imei}
{/simcards}
```

### Un solo equipo (si solo hay uno)

También puedes usar: `{marca}`, `{modelo}`, `{serie}` para la primera computadora o celular asignada, y `{numero_celular}`, `{icc}`, `{imei}` para la primera SIM.

### Condiciones (opcional)

Si quieres mostrar algo solo cuando hay datos:

- En Word no hay sintaxis especial; si no hay datos, docxtemplater deja vacío o puedes usar un bloque condicional en la plantilla (ver [docxtemplater](https://docxtemplater.com/docs/)).

## Nombre del archivo

- **FormatoComputo-.docx** → plantilla por defecto para "Formato de cómputo" (botón "Documento" en Personal).
- Puedes usar otra plantilla con: `/documento/empleado/5?plantilla=OtroFormato.docx`.

## Importante

- Guarda siempre el archivo como **.docx** (Word 2007 o superior).
- Los placeholders deben escribirse **exactamente** como en esta guía (incluidas las llaves `{ }`).
