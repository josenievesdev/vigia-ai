/**
 * Política de tratamiento de datos personales (Ley 1581 de 2012 y Decreto 1377 de 2013).
 * TEXTO BASE: antes de usarla con clientes reales, la empresa debe completar su identificación
 * (razón social, NIT, dirección y correo) y revisarla con un abogado.
 * Si el texto cambia de fondo, sube `DATA_POLICY_VERSION`: la app pedirá aceptarla de nuevo.
 */

export const DATA_POLICY_VERSION = '2026-09-26';

export interface PolicySection {
  title: string;
  paragraphs: string[];
}

export const DATA_POLICY: { title: string; summary: string; sections: PolicySection[] } = {
  title: 'Política de tratamiento de datos personales',
  summary:
    'Usamos tus datos solo para prestarte el servicio de VigíaAI: monitorear tu granja, darte soporte y gestionar tu suscripción. No los vendemos. Puedes consultarlos, corregirlos o pedir que se borren.',
  sections: [
    {
      title: 'Responsable',
      paragraphs: [
        'El responsable del tratamiento es la empresa que administra VigíaAI. Sus datos de contacto están en tu contrato de servicio y los tiene tu instalador.',
      ],
    },
    {
      title: 'Qué datos se recogen',
      paragraphs: [
        'Identificación y contacto: nombre, cédula, celular, correo y municipio.',
        'Datos de la granja: ubicación, galpones, número y edad de las aves, programa de luz y configuración de los equipos.',
        'Datos de producción y operación: huevos, muertes, alimento, lecturas de sensores, alertas y acciones de los equipos.',
        'Datos técnicos de uso: inicios de sesión y fechas de los registros.',
      ],
    },
    {
      title: 'Para qué se usan',
      paragraphs: [
        'Prestar el servicio de monitoreo y automatización de tu granja.',
        'Darte soporte técnico por medio de tu instalador.',
        'Gestionar tu cuenta, tu suscripción y los pagos.',
        'Enviarte avisos y alertas sobre tu granja.',
        'Elaborar estadísticas agregadas y anónimas para mejorar el servicio.',
      ],
    },
    {
      title: 'Quién los ve',
      paragraphs: [
        'Tú, el instalador que te atiende y el administrador de VigíaAI. Cada persona solo ve lo que le corresponde: lo garantizan reglas de acceso en la base de datos, no solo la app.',
        'Los datos se guardan en servidores de proveedores tecnológicos (Supabase) con conexión cifrada. La ubicación de la granja se usa para consultar el clima (Open-Meteo). No vendemos ni cedemos tus datos a terceros.',
      ],
    },
    {
      title: 'Tus derechos',
      paragraphs: [
        'Conocer, actualizar y corregir tus datos.',
        'Pedir prueba de la autorización que diste.',
        'Saber cómo se han usado tus datos.',
        'Revocar la autorización y pedir que se borren, cuando no haya un deber legal o contractual de conservarlos.',
        'Presentar quejas ante la Superintendencia de Industria y Comercio (SIC).',
        'Consultar tus datos de forma gratuita.',
      ],
    },
    {
      title: 'Cómo ejercerlos',
      paragraphs: [
        'Pídelo a tu instalador o al administrador de VigíaAI. Las consultas se responden en máximo 10 días hábiles y los reclamos en máximo 15 días hábiles, como indica la ley.',
      ],
    },
    {
      title: 'Vigencia',
      paragraphs: [
        `Versión ${DATA_POLICY_VERSION}. Si esta política cambia de fondo, la app te pedirá aceptarla de nuevo.`,
      ],
    },
  ],
};
