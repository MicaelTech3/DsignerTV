import os

BASE_DIR = "javascript"

files = {
    "config.js": "Configurações globais e constantes",
    "state.js": "Gerenciamento de estado global",
    "auth.js": "Autenticação do usuário",
    "toast.js": "Sistema de notificações",
    "firebase-sync.js": "Sincronização com Firebase",
    "ui-render.js": "Renderização de listas (categorias/TVs)",
    "sidebar.js": "Gerenciamento da barra lateral",
    "navigation.js": "Sistema de navegação entre seções",
    "category-manager.js": "CRUD de categorias/grupos",
    "tv-manager.js": "CRUD e controles de TVs",
    "tv-media-viewer.js": "Visualização de mídia e playlist",
    "dropzone.js": "Sistema de arrastar e soltar arquivos",
    "upload-tabs.js": "Gerenciamento de abas de upload",
    "upload-handler.js": "Manipulação de uploads",
    "icloud-manager.js": "Gerenciamento de mídias salvas",
    "media-manager.js": "Gerenciamento da lista de mídias",
    "modals.js": "Gerenciamento de modais e FAB",
    "main.js": "Ponto de entrada da aplicação"
}

TEMPLATE = """// {file}
// {description}

export function init{camel}() {{
    console.log("{camel} inicializado");

    // TODO: implementar lógica
}}
"""

MAIN_TEMPLATE = """// main.js
// Ponto de entrada da aplicação

import { initAuth } from './auth.js';
import { initSidebar } from './sidebar.js';
import { initNavigation } from './navigation.js';

document.addEventListener('DOMContentLoaded', () => {{
    initAuth();
    initSidebar();
    initNavigation();

    console.log("Aplicação inicializada");
}});
"""

def to_camel(name):
    return ''.join(word.capitalize() for word in name.replace('.js','').split('-'))

def main():
    os.makedirs(BASE_DIR, exist_ok=True)

    for file, description in files.items():
        path = os.path.join(BASE_DIR, file)

        if os.path.exists(path):
            print(f"⏭️  {file} já existe, pulando...")
            continue

        with open(path, "w", encoding="utf-8") as f:
            if file == "main.js":
                f.write(MAIN_TEMPLATE)
            else:
                f.write(
                    TEMPLATE.format(
                        file=file,
                        description=description,
                        camel=to_camel(file)
                    )
                )

        print(f"✅ Criado: {path}")

    print("\n🚀 Estrutura JavaScript criada com sucesso!")

if __name__ == "__main__":
    main()
