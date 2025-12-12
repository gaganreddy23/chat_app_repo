# 1. Define Paths (Based on your output)
$CA_PATH = "C:\Users\mgaga\.minikube\ca.crt"
$CERT_PATH = "C:\Users\mgaga\.minikube\profiles\minikube\client.crt"
$KEY_PATH = "C:\Users\mgaga\.minikube\profiles\minikube\client.key"

# 2. Read and Convert to Base64 (One long string without line breaks)
$CA_DATA = [System.Convert]::ToBase64String([System.IO.File]::ReadAllBytes($CA_PATH))
$CERT_DATA = [System.Convert]::ToBase64String([System.IO.File]::ReadAllBytes($CERT_PATH))
$KEY_DATA = [System.Convert]::ToBase64String([System.IO.File]::ReadAllBytes($KEY_PATH))

# 3. Generate the New Portable kubeconfig YAML
$YAML = @"
apiVersion: v1
clusters:
- cluster:
    # --- Embedded Certificate Data (Portable) ---
    certificate-authority-data: $CA_DATA
    extensions:
    - extension:
        last-update: Fri, 12 Dec 2025 00:31:03 IST
        provider: minikube.sigs.k8s.io
        version: v1.37.0
      name: cluster_info
    server: https://127.0.0.1:53816
  name: minikube
contexts:
- context:
    cluster: minikube
    extensions:
    - extension:
        last-update: Fri, 12 Dec 2025 00:31:03 IST
        provider: minikube.sigs.k8s.io
        version: v1.37.0
      name: context_info
    namespace: default
    user: minikube
  name: minikube
current-context: minikube
kind: Config
preferences: {}
users:
- name: minikube
  user:
    # --- Embedded Client Credentials Data (Portable) ---
    client-certificate-data: $CERT_DATA
    client-key-data: $KEY_DATA
"@

# 4. Save the new file
$YAML | Out-File -FilePath portable-config.yaml -Encoding UTF8

Write-Host "Portable kubeconfig created: portable-config.yaml"