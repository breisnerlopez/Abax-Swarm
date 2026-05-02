# Planificacion de despliegue

Antes de la version 0.1.18, los proyectos generados por Abax Swarm podian llegar a fase 7 (Despliegue) sin que el equipo hubiera confirmado donde se publicaba el sistema, con que dominio, ni como se monitoreaba o revertia. Con frecuencia los agentes detectaban esto cuando ya era tarde y entonces improvisaban — o, peor, llegaban a fase 8 (Estabilizacion) sin haber desplegado realmente.

Desde 0.1.18 hay una **rubrica explicita y bloqueante** al inicio de fase 7 que obliga a responder 12 preguntas concretas y obtener **aprobacion del usuario sponsor** antes de cualquier accion productiva.

## El bloqueante

`data/rules/phase-deliverables.yaml` define `deployment-plan-doc` como el **primer entregable obligatorio** de fase 7:

```yaml
- id: deployment-plan-doc
  name: Plan de Despliegue
  responsible: devops
  approver: product-owner   # ← cambia respecto a versiones anteriores
  mandatory: true
  artifact_type: document
```

El approver `product-owner` no es un sello de goma: el orchestrator template emite explicitamente que el PO **debe consultar al usuario sponsor** y obtener confirmacion textual en el chat antes de aprobar. Sin esa confirmacion, ningun otro entregable de fase 7 (rollback, plan de comunicacion, ejecucion del deploy, etc.) se delega.

## Las 12 preguntas

El skill [`deployment-planning`](../data/skills/deployment-planning.yaml) es la rubrica. El plan completo responde:

| # | Tema | Que debe quedar definido |
|---|---|---|
| 1 | Donde | Cloud/on-prem, region, ambientes, cuenta concreta |
| 2 | Como | Manual / CI/CD / blue-green / canary / rolling |
| 3 | **URL publica + dominio** ⚠️ | URL final exacta. Si es servicio web/API y NO tiene URL publica, **no esta en produccion** |
| 4 | DNS + TLS | Provider, certificado, renovacion automatica |
| 5 | Modelo de exposicion | Load balancer, API gateway, CDN, WAF, rate limiting |
| 6 | Secrets | Donde viven, quien rota, como se inyectan |
| 7 | Monitoring + alerting | Metricas, dashboard URL, runbook oncall, paged a quien |
| 8 | Rollback | Comando exacto, probado en staging, RTO |
| 9 | Backup | RPO/RTO, restore probado |
| 10 | Comunicacion | A stakeholders y usuarios finales |
| 11 | Compliance | Regulacion aplicable, audit log, retencion |
| 12 | SLO/SLA | Disponibilidad, latencia, responsable |

El skill incluye una **tabla de aplicabilidad por tipo de servicio** (web, API publica, mobile backend, batch/job, servicio interno) que indica cuales temas son obligatorios para cada caso.

## Quien hace que

| Rol | Responsabilidad |
|---|---|
| **devops** | Redacta el plan respondiendo las 12 preguntas con la informacion al cierre de UAT |
| **solution-architect** | Revisa donde, como, exposicion (puntos 1, 2, 5) |
| **security-architect** | Revisa TLS, secrets, compliance (puntos 4, 6, 11) |
| **project-manager** | Consolida y prepara la presentacion al sponsor |
| **product-owner** (approver) | Consulta al usuario sponsor, recibe confirmacion explicita, firma |
| **orchestrator** | Coordina via Task. NO toca git ni ejecuta nada. NO avanza sin aprobacion del sponsor |

Los 4 roles tecnicos (devops, project-manager, solution-architect, security-architect) declaran el skill `deployment-planning` y siguen su flujo de 6 pasos. El audit de tests verifica que el wiring esta consistente.

## Plantilla del entregable

El skill incluye una plantilla completa para `docs/entregables/fase-7-despliegue/00-plan-despliegue.md` con las 12 secciones y un checklist de aprobacion del sponsor al final. Ver `presentation-design.yaml` guia `plantilla-plan-despliegue`.

## Checklist pre-go-live

El skill incluye un checklist que devops ejecuta el dia del go-live, en orden:

1. Plan aprobado por sponsor — verificar firma.
2. Rollback probado en staging en las ultimas 48h.
3. Monitoring activo — dashboard responde.
4. Comunicacion previa enviada.
5. Equipo oncall disponible.
6. Backup reciente disponible.
7. DNS y certificados validos — `curl -I https://<dominio>` desde fuera de la red.
8. Ejecutar deploy.
9. Smoke test post-deploy.
10. Actualizar pagina de status si aplica.

Si alguno falla, **abort y rollback inmediato**. No hay excepciones.

## Tests

`tests/integration/deployment-pages.test.ts` valida:
- El skill existe con las 12 preguntas explicitas en sus instrucciones.
- Los 4 roles esperados lo declaran.
- El skill enfatiza que servicios web/API sin URL publica no estan en produccion.
- `deployment-plan-doc` es el **primer** deliverable de fase 7.
- El approver es `product-owner`, no `tech-lead`.
- El template del orchestrator emite la seccion "Protocolo de inicio de fase Despliegue" cuando hay roles correctos.
- La seccion menciona aprobacion EXPLICITA del usuario sponsor.
- Aplica a ambos targets (OpenCode + Claude).

## Cambiar la rubrica

Si quieres ampliar/recortar las 12 preguntas, edita `data/skills/deployment-planning.yaml` (seccion `instructions:`). Los cambios aplican al siguiente proyecto generado. Si la rubrica cambia significativamente, considera actualizar tambien la plantilla del entregable y los tests del audit.
