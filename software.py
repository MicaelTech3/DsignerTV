import subprocess
import tkinter as tk
from tkinter import filedialog, scrolledtext, simpledialog, messagebox
import re
import os
import requests
import zipfile
import io

ADB_PATH = "./platform-tools/adb.exe"
DSIGNER_APK = "com.tv.play.apk"
ADB_URL = "https://dl.google.com/android/repository/platform-tools-latest-windows.zip"

current_connected = None
status_app = False
status_adb = False
status_device = False
comandos_salvos = ["shell pm list packages", "shell input keyevent 26"]
senha_acesso = "8989"
shell_ativa = False
senha_tentativas = 0

def run_adb_command(cmd_list):
    try:
        result = subprocess.run([ADB_PATH] + cmd_list, capture_output=True, text=True)
        output = result.stdout + result.stderr
        log_output(output.strip())
        return output.strip()
    except Exception as e:
        log_output(f"Erro: {str(e)}")
        return str(e)

def log_output(text):
    log_text.configure(state="normal")
    log_text.insert(tk.END, text + "\n")
    log_text.see(tk.END)
    log_text.configure(state="disabled")

def get_device_name():
    result = run_adb_command(["devices"])
    lines = result.splitlines()
    for line in lines:
        if "device" in line and not line.startswith("List"):
            return line.split()[0]
    return None

def update_status():
    global status_device, status_adb, status_app
    status_adb = os.path.exists(ADB_PATH)
    adb_dot.config(fg="green" if status_adb else "red")
    result = run_adb_command(["devices"])
    device_found = "device" in result and not "offline" in result
    status_device = device_found
    if status_device:
        name = get_device_name()
        device_name.set(name if name else "sem conexão")
        canvas.itemconfig(circle, fill="green")
    else:
        device_name.set("sem conexão")
        canvas.itemconfig(circle, fill="red")
    if status_device:
        pkg_check = run_adb_command(["shell", "pm", "list", "packages"])
        status_app = "com.tv.play" in pkg_check
    else:
        status_app = False
    app_dot.config(fg="green" if status_app else "red")
    root.after(3000, update_status)

def editar_comando(index):
    entrada = comandos_entradas[index].get()
    comandos_salvos[index] = entrada
    atualizar_lista_comandos()

def excluir_comando(index):
    comandos_salvos.pop(index)
    atualizar_lista_comandos()

def enviar_comando():
    cmd = entry_comando.get()
    if cmd:
        run_adb_command(cmd.split())
        entry_comando.delete(0, tk.END)

def salvar_comandos():
    with open("comandos_salvos.txt", "w") as f:
        for cmd in comandos_salvos:
            f.write(cmd + "\n")
    log_output("Comandos salvos.")

def restaurar_comandos():
    global comandos_salvos
    comandos_salvos = ["shell pm list packages", "shell input keyevent 26"]
    atualizar_lista_comandos()
    log_output("Comandos restaurados.")

def atualizar_lista_comandos():
    for widget in comandos_frame.winfo_children():
        widget.destroy()
    comandos_entradas.clear()
    visible_count = 0
    for idx, cmd in enumerate(comandos_salvos):
        if visible_count >= 5 and not mostrar_todos:
            continue
        linha = tk.Frame(comandos_frame, bg="#10121a", bd=1, relief="solid")
        linha.pack(fill="x", pady=2, padx=10)
        entrada = tk.Entry(linha, width=60, fg="lime", bg="#10121a", font=("Courier", 10), insertbackground="white")
        entrada.insert(0, cmd)
        entrada.pack(side="left", padx=5)
        comandos_entradas.append(entrada)
        tk.Button(linha, text="Enviar", command=lambda i=idx: run_adb_command(entrada.get().split())).pack(side="right", padx=2)
        tk.Button(linha, text="✏", command=lambda i=idx: editar_comando(i)).pack(side="right", padx=2)
        tk.Button(linha, text="🗑", command=lambda i=idx: excluir_comando(i)).pack(side="right", padx=2)
        visible_count += 1

def toggle_shell():
    global shell_ativa
    shell_ativa = not shell_ativa
    if shell_ativa:
        senha_frame.place(x=500, y=470)
    else:
        senha_frame.place_forget()
        shell_frame.place_forget()
        log_frame.place(x=270, y=50)

def verificar_senha():
    global senha_tentativas
    entrada = ''.join([box.get() for box in senha_boxes])
    if entrada == senha_acesso:
        senha_frame.place_forget()
        shell_frame.place(x=270, y=50)
        log_frame.place_forget()
        atualizar_lista_comandos()
        senha_tentativas = 0
    else:
        senha_tentativas += 1
        if senha_tentativas >= 5:
            log_output("support 54 997124880")
        else:
            log_output("Tente novamente.")
        for box in senha_boxes:
            box.delete(0, tk.END)
        senha_boxes[0].focus_set()

def criar_novo_comando():
    comandos_salvos.append("")
    atualizar_lista_comandos()

def enable_dsigner():
    run_adb_command(["shell", "pm", "enable", "com.tv.play"])
    run_adb_command(["shell", "pm", "disable-user", "--user", "0", "com.google.android.tvlauncher"])
    run_adb_command(["shell", "cmd", "package", "set-home-activity", "com.tv.play/.MainActivity"])
    log_output("Dsigner ativado como launcher")

def enable_tvlauncher():
    run_adb_command(["shell", "pm", "enable", "com.google.android.tvlauncher"])
    run_adb_command(["shell", "pm", "disable-user", "--user", "0", "com.tv.play"])
    log_output("TV Launcher restaurado")

def install_dsigner_apk():
    if not os.path.exists(DSIGNER_APK):
        log_output(f"Erro: {DSIGNER_APK} não encontrado.")
        return
    log_output("Instalando Dsigner...")
    run_adb_command(["install", "-t", "-r", DSIGNER_APK])
    file_url = "https://d.apkpure.com/b/APK/com.lonelycatgames.Xplore?version=latest"
    temp_apk = "file_manager_temp.apk"
    try:
        log_output("🔽 Baixando gerenciador de arquivos...")
        response = requests.get(file_url, stream=True)
        with open(temp_apk, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
        log_output("✅ Download concluído. Instalando...")
        run_adb_command(["install", "-r", temp_apk])
        os.remove(temp_apk)
        log_output("✅ Gerenciador de arquivos instalado e limpo.")
    except Exception as e:
        log_output(f"❌ Falha no download ou instalação do gerenciador: {str(e)}")
    run_adb_command(["shell", "cmd", "package", "set-home-activity", "com.tv.play/.MainActivity"])
    log_output("✅ Dsigner instalado como launcher.")

def ativar_dsigner_completo():
    install_dsigner_apk()
    enable_dsigner()
    connect_via_network()

def restaurar_launcher_original():
    enable_tvlauncher()
    run_adb_command(["uninstall", "com.tv.play"])
    log_output("DSIGNER desinstalado e launcher original restaurado.")

def instalar_app_personalizado():
    filepath = filedialog.askopenfilename(filetypes=[("APK files", "*.apk")])
    if filepath:
        run_adb_command(["install", "-r", filepath])
        log_output(f"Instalado: {os.path.basename(filepath)}")

def send_media():
    filepath = filedialog.askopenfilename(filetypes=[("Mídias", "*.mp4 *.jpg *.png *.webm *.mov *.avi *.mkv")])
    if filepath:
        run_adb_command(["push", filepath, "/sdcard/"])
        log_output(f"Mídia enviada: {os.path.basename(filepath)}")

def connect_via_network():
    ip_result = run_adb_command(["shell", "ip", "addr", "show", "wlan0"])
    match = re.search(r"inet (\d+\.\d+\.\d+\.\d+)", ip_result)
    if match:
        ip = match.group(1)
        connect_result = run_adb_command(["connect", ip])
        if "connected" in connect_result or "already connected" in connect_result:
            log_output(f"Conectado via IP: {ip}")
        else:
            log_output(f"Erro ao conectar: {connect_result}")
    else:
        log_output("IP da rede não encontrado")

def instalar_adb():
    if os.path.exists("./platform-tools"):
        log_output("ADB já está instalado.")
        return
    log_output("Baixando ADB...")
    try:
        response = requests.get(ADB_URL)
        with zipfile.ZipFile(io.BytesIO(response.content)) as zip_ref:
            zip_ref.extractall()
        log_output("ADB instalado com sucesso.")
    except Exception as e:
        log_output(f"Erro ao instalar ADB: {str(e)}")

root = tk.Tk()
root.title("SOFTWARE DSIGNERTV")
root.geometry("900x600")
root.configure(bg="#0f111a")
root.resizable(False, False)

comandos_entradas = []
mostrar_todos = False

def toggle_mostrar_todos():
    global mostrar_todos
    mostrar_todos = not mostrar_todos
    atualizar_lista_comandos()

header = tk.Frame(root, bg="#0f111a")
header.place(x=10, y=10)
canvas = tk.Canvas(header, width=20, height=20, bg="#0f111a", highlightthickness=0)
circle = canvas.create_oval(2, 2, 18, 18, fill="red")
canvas.pack(side="left", padx=5)
device_name = tk.StringVar(value="sem conexão")
tk.Label(header, textvariable=device_name, fg="white", bg="#0f111a", font=("Arial", 12)).pack(side="left")

tk.Label(root, text="DsignerTV", font=("Arial", 16, "bold"), fg="#1ec6ff", bg="#0f111a").place(x=450, y=10)

btns = [
    ("ATIVAR Dsigner", ativar_dsigner_completo),
    ("Restaurar TV", restaurar_launcher_original),
    ("Instalar Outros", instalar_app_personalizado),
    ("Enviar Mídia", send_media),
    ("Conectar Via Rede", connect_via_network),
    ("INSTALAR ADB", instalar_adb),
]
y_offset = 50
for text, command in btns:
    tk.Button(root, text=text, command=command, width=20, bg="#2c2f3a", fg="white", font=("Arial", 11, "bold"), relief="flat", bd=2).place(x=20, y=y_offset)
    y_offset += 45

reboot_button = tk.Button(root, text="⟳", command=lambda: run_adb_command(["reboot"]), font=("Arial", 18, "bold"), fg="white", bg="#1ec6ff", bd=0, relief="flat", width=2, height=1)
reboot_button.place(x=860, y=20)

log_frame = tk.Frame(root, bg="#0f111a", bd=2, relief="groove",  width=470, height=380)
log_frame.place(x=350, y=50)
tk.Label(log_frame, text="log shell", bg="#0f111a", fg="white", font=("Arial", 10)).pack()
log_text = scrolledtext.ScrolledText(log_frame, width=60, height=18, bg="#10121a", fg="lime", font=("Courier", 9))
log_text.pack(padx=10, pady=5)
log_text.configure(state="disabled")

tk.Button(root, text="Edit Shell", command=toggle_shell, width=60, bg="#2c2f3a", fg="white", font=("Arial", 10, "bold"), relief="flat", bd=2).place(x=350, y=440)

senha_frame = tk.Frame(root, bg="#0f111a")
senha_boxes = []
for i in range(4):
    box = tk.Entry(senha_frame, width=2, font=("Arial", 20), justify="center", show="*")
    box.pack(side="left", padx=5)
    senha_boxes.append(box)
    def on_key_release(event, idx=i):
        value = senha_boxes[idx].get()
        if len(value) > 1:
            senha_boxes[idx].delete(1, tk.END)
        if idx < 3 and value:
            senha_boxes[idx + 1].focus_set()
        elif idx == 3:
            verificar_senha()
    box.bind("<KeyRelease>", on_key_release)

senha_frame.place_forget()

shell_frame = tk.Frame(root, bg="#0f111a", bd=2, relief="groove", width=470, height=380)
shell_frame.place_forget()
tk.Label(shell_frame, text="Comandos", fg="white", bg="#0f111a", font=("Arial", 10)).pack()
comandos_frame = tk.Frame(shell_frame, bg="#0f111a")
comandos_frame.pack(pady=5)

entry_comando = tk.Entry(shell_frame, width=60)
entry_comando.pack(pady=2)
tk.Button(shell_frame, text="Enviar", command=enviar_comando).pack(pady=2)

comandos_footer = tk.Frame(shell_frame, bg="#0f111a")
comandos_footer.pack(pady=5)
tk.Button(comandos_footer, text="Criar", command=criar_novo_comando).pack(side="left", padx=10)
tk.Button(comandos_footer, text="Restaurar", command=restaurar_comandos).pack(side="left", padx=10)
tk.Button(comandos_footer, text="All", command=toggle_mostrar_todos).pack(side="left", padx=10)

footer = tk.Frame(root, bg="#0f111a")
footer.pack(side="bottom", fill="x", pady=10)
tk.Label(footer, text="SOBRE VERSÃO", fg="white", bg="#0f111a", font=("Arial", 8)).pack(side="left", padx=10)
status_frame = tk.Frame(footer, bg="#0f111a")
status_frame.pack(side="right", padx=10)
app_dot = tk.Label(status_frame, text="APP ●", fg="red", bg="#0f111a", font=("Arial", 9, "bold"))
app_dot.pack(side="left", padx=5)
adb_dot = tk.Label(status_frame, text="ADB ●", fg="red", bg="#0f111a", font=("Arial", 9, "bold"))
adb_dot.pack(side="left", padx=5)
device_dot = tk.Label(status_frame, text="DISP ●", fg="red", bg="#0f111a", font=("Arial", 9, "bold"))
device_dot.pack(side="left", padx=5)

root.after(1000, update_status)
root.mainloop()
