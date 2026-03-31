# Coop Landing Page i18n - Translation JSON Templates

Ready-to-use translation files for all 5 languages. Copy-paste to get started immediately.

---

## Directory Structure to Create

```bash
packages/app/src/i18n/translations/
├── en/
│   ├── common.json
│   ├── landing.json
│   ├── ritual.json
│   └── errors.json
├── pt-BR/
│   ├── common.json
│   ├── landing.json
│   ├── ritual.json
│   └── errors.json
├── es/
│   ├── common.json
│   ├── landing.json
│   ├── ritual.json
│   └── errors.json
├── zh-CN/
│   ├── common.json
│   ├── landing.json
│   ├── ritual.json
│   └── errors.json
└── fr/
    ├── common.json
    ├── landing.json
    ├── ritual.json
    └── errors.json
```

---

## 1. English (en/) - Base Language

### en/common.json
```json
{
  "language": "Language",
  "english": "English",
  "portuguese": "Português (Brasil)",
  "spanish": "Español",
  "mandarin": "中文 (简体)",
  "french": "Français",
  "save": "Save",
  "cancel": "Cancel",
  "close": "Close",
  "download": "Download",
  "share": "Share",
  "copy": "Copy",
  "copied": "Copied!",
  "error": "Error",
  "success": "Success",
  "loading": "Loading...",
  "or": "or"
}
```

### en/landing.json
```json
{
  "chicken": {
    "tabs": "Tabs",
    "notes": "Notes",
    "ideas": "Ideas",
    "signals": "Signals",
    "links": "Links",
    "drafts": "Drafts",
    "threads": "Threads",
    "clips": "Clips",
    "bookmarks": "Bookmarks",
    "photos": "Photos",
    "voiceMemos": "Voice Memos",
    "receipts": "Receipts"
  },
  "audience": {
    "personal": "Personal",
    "personalTone": "Personal focus and reflection",
    "family": "Family",
    "familyTone": "Household memory and support",
    "friends": "Friends",
    "friendsTone": "Shared momentum with trusted peers",
    "community": "Community",
    "communityTone": "Collective coordination and stewardship"
  },
  "hero": {
    "callClip": "Call clip",
    "callClipText": "Save the key moment before it drifts.",
    "browserTab": "Browser tab",
    "browserTabText": "This grant lead is worth the follow-up.",
    "fieldNote": "Field note",
    "fieldNoteText": "Member energy is shifting this week.",
    "looseThread": "Loose thread",
    "looseThreadText": "Remember to reconnect this after the meeting."
  },
  "howItWorks": {
    "title1": "Your data stays yours",
    "detail1": "Everything you capture stays on your device until your group decides what to share.",
    "title2": "One place for everything",
    "detail2": "Tabs, notes, files, and call fragments land together before they scatter.",
    "title3": "Shared review loop",
    "detail3": "One clear queue for the group instead of hunting across chats, browsers, and memory.",
    "title4": "Proof that lasts",
    "detail4": "Progress and outcomes stay close to the work so updates are easier to revisit and trust."
  },
  "chickenThoughts": {
    "tabs": {
      "kicker": "Browser tab",
      "text": "This grant lead is worth the follow-up."
    },
    "notes": {
      "kicker": "Field note",
      "text": "Member energy is shifting this week."
    },
    "ideas": {
      "kicker": "Loose thread",
      "text": "Reconnect this after the meeting."
    },
    "signals": {
      "kicker": "Call clip",
      "text": "Save the key moment before it drifts."
    },
    "links": {
      "kicker": "Saved link",
      "text": "This keeps coming back up in conversations."
    },
    "drafts": {
      "kicker": "Draft",
      "text": "Half-finished but worth keeping close."
    },
    "threads": {
      "kicker": "Thread",
      "text": "Conversation fragments from last week."
    },
    "clips": {
      "kicker": "Clip",
      "text": "Audio moment worth revisiting."
    },
    "bookmarks": {
      "kicker": "Bookmark",
      "text": "This link keeps coming back up."
    },
    "photos": {
      "kicker": "Photo",
      "text": "Captured in the field last Tuesday."
    },
    "voiceMemos": {
      "kicker": "Voice memo",
      "text": "Quick capture from the walk home."
    },
    "receipts": {
      "kicker": "Receipt",
      "text": "Proof of the contribution last month."
    }
  }
}
```

### en/ritual.json
```json
{
  "knowledge": "Knowledge & Tools",
  "knowledgeShort": "Knowledge",
  "capital": "Money & Resources",
  "capitalShort": "Money",
  "governance": "Decisions & Teamwork",
  "governanceShort": "Decisions",
  "impact": "Impact & Progress",
  "impactShort": "Impact",
  "fields": {
    "current": "What's working now?",
    "currentShort": "Current state",
    "pain": "What's the pain point?",
    "painShort": "Pain point",
    "improve": "How can we improve?",
    "improveShort": "How to improve"
  },
  "status": {
    "ready": "Ready to distill",
    "drafting": "Gathering details",
    "empty": "Start capturing"
  }
}
```

### en/errors.json
```json
{
  "microphone": {
    "notAllowed": "Microphone or speech permissions were denied. Type notes manually for this card.",
    "audioCapture": "No microphone is available here. You can still type notes into the card.",
    "noSpeech": "No speech was detected. Try again or type notes manually.",
    "unknown": "Live transcript stopped unexpectedly. Your typed notes are still safe."
  },
  "status": {
    "ready": "Ready",
    "drafting": "In progress",
    "empty": "Not started"
  },
  "transcript": "Use live transcript if this browser supports it, or type directly into the card. Everything stays saved on this device.",
  "validation": {
    "required": "This field is required",
    "minLength": "Must be at least {{min}} characters",
    "maxLength": "Must be no more than {{max}} characters",
    "invalidEmail": "Please enter a valid email address"
  }
}
```

---

## 2. Portuguese (Brazil) - pt-BR/

### pt-BR/common.json
```json
{
  "language": "Idioma",
  "english": "English",
  "portuguese": "Português (Brasil)",
  "spanish": "Español",
  "mandarin": "中文 (简体)",
  "french": "Français",
  "save": "Salvar",
  "cancel": "Cancelar",
  "close": "Fechar",
  "download": "Baixar",
  "share": "Compartilhar",
  "copy": "Copiar",
  "copied": "Copiado!",
  "error": "Erro",
  "success": "Sucesso",
  "loading": "Carregando...",
  "or": "ou"
}
```

### pt-BR/landing.json
```json
{
  "chicken": {
    "tabs": "Abas",
    "notes": "Anotações",
    "ideas": "Ideias",
    "signals": "Sinais",
    "links": "Links",
    "drafts": "Rascunhos",
    "threads": "Conversas",
    "clips": "Clipes",
    "bookmarks": "Favoritos",
    "photos": "Fotos",
    "voiceMemos": "Notas de Voz",
    "receipts": "Recibos"
  },
  "audience": {
    "personal": "Pessoal",
    "personalTone": "Reflexão e foco pessoal",
    "family": "Família",
    "familyTone": "Memória e apoio familiar",
    "friends": "Amigos",
    "friendsTone": "Momentum compartilhado com pares confiáveis",
    "community": "Comunidade",
    "communityTone": "Coordenação e administração coletivas"
  },
  "hero": {
    "callClip": "Trecho de chamada",
    "callClipText": "Capture o momento-chave antes que se disperse.",
    "browserTab": "Aba do navegador",
    "browserTabText": "Esse contato de subsídio vale um acompanhamento.",
    "fieldNote": "Anotação de campo",
    "fieldNoteText": "A energia dos membros está mudando essa semana.",
    "looseThread": "Conversa incompleta",
    "looseThreadText": "Lembre-se de reconectar isso após a reunião."
  },
  "howItWorks": {
    "title1": "Seus dados continuam sendo seus",
    "detail1": "Tudo que você captura fica no seu dispositivo até seu grupo decidir o que compartilhar.",
    "title2": "Um lugar para tudo",
    "detail2": "Abas, anotações, arquivos e fragmentos de chamadas se juntam antes de se dispersarem.",
    "title3": "Loop de revisão compartilhada",
    "detail3": "Uma fila clara para o grupo em vez de procurar em chats, navegadores e memória.",
    "title4": "Prova que perdura",
    "detail4": "O progresso e os resultados ficam perto do trabalho, facilitando revisitar e confiar nas atualizações."
  },
  "chickenThoughts": {
    "tabs": {
      "kicker": "Aba do navegador",
      "text": "Esse contato de subsídio vale um acompanhamento."
    },
    "notes": {
      "kicker": "Anotação de campo",
      "text": "A energia dos membros está mudando essa semana."
    },
    "ideas": {
      "kicker": "Conversa incompleta",
      "text": "Reconecte isso após a reunião."
    },
    "signals": {
      "kicker": "Trecho de chamada",
      "text": "Capture o momento-chave antes que se disperse."
    },
    "links": {
      "kicker": "Link salvo",
      "text": "Isso continua aparecendo nas conversas."
    },
    "drafts": {
      "kicker": "Rascunho",
      "text": "Inacabado, mas vale manter próximo."
    },
    "threads": {
      "kicker": "Conversa",
      "text": "Fragmentos de discussão da semana passada."
    },
    "clips": {
      "kicker": "Clipe",
      "text": "Momento de áudio para revisitar."
    },
    "bookmarks": {
      "kicker": "Favorito",
      "text": "Esse link continua aparecendo."
    },
    "photos": {
      "kicker": "Foto",
      "text": "Capturada em campo na terça passada."
    },
    "voiceMemos": {
      "kicker": "Nota de voz",
      "text": "Captura rápida do caminho para casa."
    },
    "receipts": {
      "kicker": "Recibo",
      "text": "Comprovante da contribuição do mês passado."
    }
  }
}
```

### pt-BR/ritual.json
```json
{
  "knowledge": "Conhecimento & Ferramentas",
  "knowledgeShort": "Conhecimento",
  "capital": "Dinheiro & Recursos",
  "capitalShort": "Dinheiro",
  "governance": "Decisões & Trabalho em Equipe",
  "governanceShort": "Decisões",
  "impact": "Impacto & Progresso",
  "impactShort": "Impacto",
  "fields": {
    "current": "O que está funcionando agora?",
    "currentShort": "Estado atual",
    "pain": "Qual é o problema?",
    "painShort": "Problema",
    "improve": "Como podemos melhorar?",
    "improveShort": "Como melhorar"
  },
  "status": {
    "ready": "Pronto para destilação",
    "drafting": "Coletando detalhes",
    "empty": "Comece a capturar"
  }
}
```

### pt-BR/errors.json
```json
{
  "microphone": {
    "notAllowed": "Permissões de microfone ou fala foram negadas. Digite as anotações manualmente neste cartão.",
    "audioCapture": "Nenhum microfone está disponível aqui. Você ainda pode digitar anotações no cartão.",
    "noSpeech": "Nenhuma fala foi detectada. Tente novamente ou digite as anotações manualmente.",
    "unknown": "A transcrição ao vivo parou inesperadamente. Suas anotações digitadas ainda estão seguras."
  },
  "status": {
    "ready": "Pronto",
    "drafting": "Em progresso",
    "empty": "Não iniciado"
  },
  "transcript": "Use transcrição ao vivo se este navegador suportar ou digite diretamente no cartão. Tudo fica salvo neste dispositivo.",
  "validation": {
    "required": "Este campo é obrigatório",
    "minLength": "Deve ter no mínimo {{min}} caracteres",
    "maxLength": "Deve ter no máximo {{max}} caracteres",
    "invalidEmail": "Por favor, digite um endereço de email válido"
  }
}
```

---

## 3. Spanish - es/

### es/common.json
```json
{
  "language": "Idioma",
  "english": "English",
  "portuguese": "Português (Brasil)",
  "spanish": "Español",
  "mandarin": "中文 (简体)",
  "french": "Français",
  "save": "Guardar",
  "cancel": "Cancelar",
  "close": "Cerrar",
  "download": "Descargar",
  "share": "Compartir",
  "copy": "Copiar",
  "copied": "¡Copiado!",
  "error": "Error",
  "success": "Éxito",
  "loading": "Cargando...",
  "or": "o"
}
```

### es/landing.json
```json
{
  "chicken": {
    "tabs": "Pestañas",
    "notes": "Notas",
    "ideas": "Ideas",
    "signals": "Señales",
    "links": "Enlaces",
    "drafts": "Borradores",
    "threads": "Hilos",
    "clips": "Clips",
    "bookmarks": "Marcadores",
    "photos": "Fotos",
    "voiceMemos": "Notas de Voz",
    "receipts": "Recibos"
  },
  "audience": {
    "personal": "Personal",
    "personalTone": "Enfoque y reflexión personal",
    "family": "Familia",
    "familyTone": "Memoria y apoyo familiar",
    "friends": "Amigos",
    "friendsTone": "Impulso compartido con pares de confianza",
    "community": "Comunidad",
    "communityTone": "Coordinación e intendencia colectivas"
  },
  "hero": {
    "callClip": "Clip de llamada",
    "callClipText": "Captura el momento clave antes de que se pierda.",
    "browserTab": "Pestaña del navegador",
    "browserTabText": "Este contacto de subvención merece un seguimiento.",
    "fieldNote": "Nota de campo",
    "fieldNoteText": "La energía del grupo está cambiando esta semana.",
    "looseThread": "Hilo suelto",
    "looseThreadText": "Recuerda reconectar esto después de la reunión."
  },
  "howItWorks": {
    "title1": "Tus datos siguen siendo tuyos",
    "detail1": "Todo lo que capturas se queda en tu dispositivo hasta que tu grupo decida qué compartir.",
    "title2": "Un lugar para todo",
    "detail2": "Pestañas, notas, archivos y fragmentos de llamadas se juntan antes de dispersarse.",
    "title3": "Ciclo de revisión compartida",
    "detail3": "Una cola clara para el grupo en lugar de buscar en chats, navegadores y memoria.",
    "title4": "Prueba que perdura",
    "detail4": "El progreso y los resultados se mantienen cerca del trabajo para que las actualizaciones sean más fáciles de revisar y confiar."
  },
  "chickenThoughts": {
    "tabs": {
      "kicker": "Pestaña del navegador",
      "text": "Este contacto de subvención merece un seguimiento."
    },
    "notes": {
      "kicker": "Nota de campo",
      "text": "La energía del grupo está cambiando esta semana."
    },
    "ideas": {
      "kicker": "Hilo suelto",
      "text": "Reconecta esto después de la reunión."
    },
    "signals": {
      "kicker": "Clip de llamada",
      "text": "Captura el momento clave antes de que se pierda."
    },
    "links": {
      "kicker": "Enlace guardado",
      "text": "Esto sigue apareciendo en las conversaciones."
    },
    "drafts": {
      "kicker": "Borrador",
      "text": "Inacabado pero vale la pena mantenerlo cerca."
    },
    "threads": {
      "kicker": "Hilo",
      "text": "Fragmentos de conversación de la semana pasada."
    },
    "clips": {
      "kicker": "Clip",
      "text": "Momento de audio que vale la pena revisar."
    },
    "bookmarks": {
      "kicker": "Marcador",
      "text": "Este enlace sigue apareciendo."
    },
    "photos": {
      "kicker": "Foto",
      "text": "Capturada en el terreno el martes pasado."
    },
    "voiceMemos": {
      "kicker": "Nota de voz",
      "text": "Captura rápida del camino a casa."
    },
    "receipts": {
      "kicker": "Recibo",
      "text": "Comprobante de la contribución del mes pasado."
    }
  }
}
```

### es/ritual.json
```json
{
  "knowledge": "Conocimiento & Herramientas",
  "knowledgeShort": "Conocimiento",
  "capital": "Dinero & Recursos",
  "capitalShort": "Dinero",
  "governance": "Decisiones & Trabajo en Equipo",
  "governanceShort": "Decisiones",
  "impact": "Impacto & Progreso",
  "impactShort": "Impacto",
  "fields": {
    "current": "¿Qué está funcionando ahora?",
    "currentShort": "Estado actual",
    "pain": "¿Cuál es el problema?",
    "painShort": "Problema",
    "improve": "¿Cómo podemos mejorar?",
    "improveShort": "Cómo mejorar"
  },
  "status": {
    "ready": "Listo para destilar",
    "drafting": "Recopilando detalles",
    "empty": "Comienza a capturar"
  }
}
```

### es/errors.json
```json
{
  "microphone": {
    "notAllowed": "Los permisos de micrófono o voz fueron denegados. Escribe las notas manualmente en esta tarjeta.",
    "audioCapture": "No hay micrófono disponible aquí. Aún puedes escribir notas en la tarjeta.",
    "noSpeech": "No se detectó voz. Intenta de nuevo o escribe las notas manualmente.",
    "unknown": "La transcripción en vivo se detuvo inesperadamente. Tus notas escritas siguen siendo seguras."
  },
  "status": {
    "ready": "Listo",
    "drafting": "En progreso",
    "empty": "No iniciado"
  },
  "transcript": "Usa transcripción en vivo si este navegador la admite o escribe directamente en la tarjeta. Todo se guarda en este dispositivo.",
  "validation": {
    "required": "Este campo es obligatorio",
    "minLength": "Debe tener al menos {{min}} caracteres",
    "maxLength": "Debe tener no más de {{max}} caracteres",
    "invalidEmail": "Por favor, introduce una dirección de correo electrónico válida"
  }
}
```

---

## 4. Mandarin Chinese (Simplified) - zh-CN/

### zh-CN/common.json
```json
{
  "language": "语言",
  "english": "English",
  "portuguese": "Português (Brasil)",
  "spanish": "Español",
  "mandarin": "中文 (简体)",
  "french": "Français",
  "save": "保存",
  "cancel": "取消",
  "close": "关闭",
  "download": "下载",
  "share": "分享",
  "copy": "复制",
  "copied": "已复制！",
  "error": "错误",
  "success": "成功",
  "loading": "加载中...",
  "or": "或"
}
```

### zh-CN/landing.json
```json
{
  "chicken": {
    "tabs": "标签页",
    "notes": "笔记",
    "ideas": "想法",
    "signals": "信号",
    "links": "链接",
    "drafts": "草稿",
    "threads": "话题",
    "clips": "片段",
    "bookmarks": "书签",
    "photos": "照片",
    "voiceMemos": "语音备忘录",
    "receipts": "凭证"
  },
  "audience": {
    "personal": "个人",
    "personalTone": "个人专注与反思",
    "family": "家庭",
    "familyTone": "家庭记忆与支持",
    "friends": "朋友",
    "friendsTone": "与信任的同伴共同推进",
    "community": "社区",
    "communityTone": "集体协调与管理"
  },
  "hero": {
    "callClip": "通话片段",
    "callClipText": "在关键时刻消失前捕捉它。",
    "browserTab": "浏览器标签页",
    "browserTabText": "这个资助线索值得跟进。",
    "fieldNote": "现场笔记",
    "fieldNoteText": "成员的状态本周在发生变化。",
    "looseThread": "未完成的讨论",
    "looseThreadText": "记得在会议后重新连接这个话题。"
  },
  "howItWorks": {
    "title1": "您的数据仍然是您的",
    "detail1": "您捕获的所有内容都保留在您的设备上，直到您的小组决定分享什么。",
    "title2": "一个地方包含一切",
    "detail2": "标签页、笔记、文件和通话片段在分散之前聚集在一起。",
    "title3": "共享审查循环",
    "detail3": "小组有一个清晰的队列，而不是在聊天、浏览器和记忆中搜索。",
    "title4": "持久的证明",
    "detail4": "进展和成果与工作紧密相连，使更新更容易审查和信任。"
  },
  "chickenThoughts": {
    "tabs": {
      "kicker": "浏览器标签页",
      "text": "这个资助线索值得跟进。"
    },
    "notes": {
      "kicker": "现场笔记",
      "text": "成员的状态本周在发生变化。"
    },
    "ideas": {
      "kicker": "未完成的讨论",
      "text": "记得在会议后重新连接这个话题。"
    },
    "signals": {
      "kicker": "通话片段",
      "text": "在关键时刻消失前捕捉它。"
    },
    "links": {
      "kicker": "已保存的链接",
      "text": "这个在对话中一直出现。"
    },
    "drafts": {
      "kicker": "草稿",
      "text": "未完成但值得保存。"
    },
    "threads": {
      "kicker": "话题",
      "text": "上周的对话片段。"
    },
    "clips": {
      "kicker": "片段",
      "text": "值得重新审视的音频时刻。"
    },
    "bookmarks": {
      "kicker": "书签",
      "text": "这个链接一直在出现。"
    },
    "photos": {
      "kicker": "照片",
      "text": "上周二在现场拍摄。"
    },
    "voiceMemos": {
      "kicker": "语音备忘录",
      "text": "回家路上的快速捕获。"
    },
    "receipts": {
      "kicker": "凭证",
      "text": "上月贡献的证明。"
    }
  }
}
```

### zh-CN/ritual.json
```json
{
  "knowledge": "知识与工具",
  "knowledgeShort": "知识",
  "capital": "金钱与资源",
  "capitalShort": "金钱",
  "governance": "决策与团队合作",
  "governanceShort": "决策",
  "impact": "影响与进度",
  "impactShort": "影响",
  "fields": {
    "current": "现在什么在起作用？",
    "currentShort": "当前状态",
    "pain": "痛点是什么？",
    "painShort": "痛点",
    "improve": "我们如何改进？",
    "improveShort": "如何改进"
  },
  "status": {
    "ready": "准备好提炼",
    "drafting": "收集详情",
    "empty": "开始捕获"
  }
}
```

### zh-CN/errors.json
```json
{
  "microphone": {
    "notAllowed": "麦克风或语音权限被拒绝。请手动在此卡中输入笔记。",
    "audioCapture": "此处没有麦克风可用。您仍然可以在卡中输入笔记。",
    "noSpeech": "未检测到语音。请重试或手动输入笔记。",
    "unknown": "实时转录意外停止。您的输入笔记仍然安全。"
  },
  "status": {
    "ready": "准备好",
    "drafting": "进行中",
    "empty": "未开始"
  },
  "transcript": "如果此浏览器支持，请使用实时转录或直接在卡中输入。所有内容都保存在此设备上。",
  "validation": {
    "required": "此字段是必需的",
    "minLength": "必须至少为 {{min}} 个字符",
    "maxLength": "不得超过 {{max}} 个字符",
    "invalidEmail": "请输入有效的电子邮件地址"
  }
}
```

---

## 5. French - fr/

### fr/common.json
```json
{
  "language": "Langue",
  "english": "English",
  "portuguese": "Português (Brasil)",
  "spanish": "Español",
  "mandarin": "中文 (简体)",
  "french": "Français",
  "save": "Enregistrer",
  "cancel": "Annuler",
  "close": "Fermer",
  "download": "Télécharger",
  "share": "Partager",
  "copy": "Copier",
  "copied": "Copié !",
  "error": "Erreur",
  "success": "Succès",
  "loading": "Chargement...",
  "or": "ou"
}
```

### fr/landing.json
```json
{
  "chicken": {
    "tabs": "Onglets",
    "notes": "Notes",
    "ideas": "Idées",
    "signals": "Signaux",
    "links": "Liens",
    "drafts": "Brouillons",
    "threads": "Fils",
    "clips": "Clips",
    "bookmarks": "Signets",
    "photos": "Photos",
    "voiceMemos": "Mémos vocaux",
    "receipts": "Reçus"
  },
  "audience": {
    "personal": "Personnel",
    "personalTone": "Concentration et réflexion personnelles",
    "family": "Famille",
    "familyTone": "Mémoire et soutien familiaux",
    "friends": "Amis",
    "friendsTone": "Élan partagé avec des pairs de confiance",
    "community": "Communauté",
    "communityTone": "Coordination et intendance collectives"
  },
  "hero": {
    "callClip": "Extrait d'appel",
    "callClipText": "Capturez le moment clé avant qu'il ne s'efface.",
    "browserTab": "Onglet du navigateur",
    "browserTabText": "Ce contact de subvention mérite un suivi.",
    "fieldNote": "Note de terrain",
    "fieldNoteText": "L'énergie du groupe change cette semaine.",
    "looseThread": "Fil rouge",
    "looseThreadText": "N'oubliez pas de reconnecter cela après la réunion."
  },
  "howItWorks": {
    "title1": "Vos données vous restent",
    "detail1": "Tout ce que vous capturez reste sur votre appareil jusqu'à ce que votre groupe décide de partager.",
    "title2": "Un endroit pour tout",
    "detail2": "Les onglets, notes, fichiers et fragments d'appels se réunissent avant de se disperser.",
    "title3": "Boucle de révision partagée",
    "detail3": "Une file d'attente claire pour le groupe au lieu de chercher dans les chats, navigateurs et la mémoire.",
    "title4": "Preuve qui dure",
    "detail4": "Le progrès et les résultats restent proches du travail pour que les mises à jour soient plus faciles à revoir et approuver."
  },
  "chickenThoughts": {
    "tabs": {
      "kicker": "Onglet du navigateur",
      "text": "Ce contact de subvention mérite un suivi."
    },
    "notes": {
      "kicker": "Note de terrain",
      "text": "L'énergie du groupe change cette semaine."
    },
    "ideas": {
      "kicker": "Fil rouge",
      "text": "Reconnectez cela après la réunion."
    },
    "signals": {
      "kicker": "Extrait d'appel",
      "text": "Capturez le moment clé avant qu'il ne s'efface."
    },
    "links": {
      "kicker": "Lien enregistré",
      "text": "Cela continue à revenir dans les conversations."
    },
    "drafts": {
      "kicker": "Brouillon",
      "text": "Inachevé mais mérite d'être gardé à proximité."
    },
    "threads": {
      "kicker": "Fil",
      "text": "Fragments de conversation de la semaine dernière."
    },
    "clips": {
      "kicker": "Clip",
      "text": "Moment audio qui mérite d'être revisité."
    },
    "bookmarks": {
      "kicker": "Signet",
      "text": "Ce lien continue à revenir."
    },
    "photos": {
      "kicker": "Photo",
      "text": "Capturée sur le terrain mardi dernier."
    },
    "voiceMemos": {
      "kicker": "Mémo vocal",
      "text": "Capture rapide du chemin du retour."
    },
    "receipts": {
      "kicker": "Reçu",
      "text": "Preuve de la contribution du mois dernier."
    }
  }
}
```

### fr/ritual.json
```json
{
  "knowledge": "Connaissance & Outils",
  "knowledgeShort": "Connaissance",
  "capital": "Argent & Ressources",
  "capitalShort": "Argent",
  "governance": "Décisions & Travail d'équipe",
  "governanceShort": "Décisions",
  "impact": "Impact & Progrès",
  "impactShort": "Impact",
  "fields": {
    "current": "Qu'est-ce qui fonctionne maintenant ?",
    "currentShort": "État actuel",
    "pain": "Quel est le point douloureux ?",
    "painShort": "Point douloureux",
    "improve": "Comment pouvons-nous améliorer ?",
    "improveShort": "Comment améliorer"
  },
  "status": {
    "ready": "Prêt à distiller",
    "drafting": "Collecte de détails",
    "empty": "Commencez à capturer"
  }
}
```

### fr/errors.json
```json
{
  "microphone": {
    "notAllowed": "Les permissions du microphone ou de la voix ont été refusées. Tapez les notes manuellement sur cette carte.",
    "audioCapture": "Aucun microphone n'est disponible ici. Vous pouvez toujours taper des notes sur la carte.",
    "noSpeech": "Aucune parole détectée. Réessayez ou tapez les notes manuellement.",
    "unknown": "La transcription en direct s'est arrêtée de manière inattendue. Vos notes tapées restent sûres."
  },
  "status": {
    "ready": "Prêt",
    "drafting": "En cours",
    "empty": "Non commencé"
  },
  "transcript": "Utilisez la transcription en direct si ce navigateur la supporte ou tapez directement sur la carte. Tout est sauvegardé sur cet appareil.",
  "validation": {
    "required": "Ce champ est obligatoire",
    "minLength": "Doit contenir au moins {{min}} caractères",
    "maxLength": "Ne doit pas dépasser {{max}} caractères",
    "invalidEmail": "Veuillez entrer une adresse électronique valide"
  }
}
```

---

## Quick Copy-Paste Instructions

1. **Create directories:**
```bash
mkdir -p packages/app/src/i18n/translations/{en,pt-BR,es,zh-CN,fr}
```

2. **Copy each JSON block above into corresponding files:**
   - `en/common.json`, `en/landing.json`, `en/ritual.json`, `en/errors.json`
   - `pt-BR/common.json`, `pt-BR/landing.json`, `pt-BR/ritual.json`, `pt-BR/errors.json`
   - `es/common.json`, `es/landing.json`, `es/ritual.json`, `es/errors.json`
   - `zh-CN/common.json`, `zh-CN/landing.json`, `zh-CN/ritual.json`, `zh-CN/errors.json`
   - `fr/common.json`, `fr/landing.json`, `fr/ritual.json`, `fr/errors.json`

3. **Verify structure:**
```bash
tree packages/app/src/i18n/translations/
# Should show 5 language directories × 4 JSON files = 20 files
```

4. **Format check:**
```bash
cd packages/app && bun run format
# Validates all JSON files are properly formatted
```

---

## Validation Checklist

- [ ] All 20 JSON files created
- [ ] No missing keys (compare with English version)
- [ ] Valid JSON syntax (no trailing commas)
- [ ] UTF-8 encoding preserved (especially for zh-CN)
- [ ] Key names identical across all languages
- [ ] Character encoding: UTF-8 (not ASCII)
- [ ] No HTML entities (use actual characters)

---

**Ready to integrate!** Copy these templates into your project and proceed with the setup guide.
