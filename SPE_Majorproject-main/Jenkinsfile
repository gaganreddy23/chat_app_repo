pipeline {
    agent any
    environment {
       FRONTEND_URL='http://localhost:3000'
       MONGODB_URI='mongodb+srv://asrithnune03:asrithrishi@discuss.lieci.mongodb.net/?retryWrites=true&w=majority&appName=DiscUss'
       JWT_SECRET_KEY='jhdcjhsdvchjsdhbfasdgbvs'
       REACT_APP_CLOUDINARY_CLOUD_NAME = 'dd4osfetw'
       REACT_APP_BACKEND_URL = 'http://localhost:8080'
       PORT='8080'
       KUBECONFIG = '/var/lib/jenkins/.kube/config'
    }
    stages {
        stage('Clone Git') {
            steps {
                git branch: 'main', url: 'https://github.com/Asrith16/SPE_Majorproject.git'
            }
        }
        stage('Build Frontend Image') {
            steps {
                dir('client'){
                sh "npm install"
                sh 'docker build -t frontend-image .'
            }
            }
        }
        stage('Build Backend Image') {
            steps {
                dir('server'){
                sh "npm install"
                sh 'docker build -t backend-image .'
            }
            }
        }
        stage('Push to Docker Hub') {
            steps {
                script {
                        sh "docker login --username asrith1158 --password Chandrausha@123"
                        sh 'docker tag frontend-image asrith1158/frontend-image:latest'
                        sh 'docker push asrith1158/frontend-image:latest'
                        sh "docker tag backend-image asrith1158/backend-image:latest"
                        sh "docker push asrith1158/backend-image:latest"
                    
                }
            }
        }
        stage('Install Dependencies') {
            steps {
                script {
                    sh 'ansible-galaxy collection install kubernetes.core'
                }
            }
        }
        stage('Kubernetes') {
            steps {
                script {
                    sh 'ansible-playbook -i inventory-k8 playbook-k8.yml'
                }
            }
        }
    }
}