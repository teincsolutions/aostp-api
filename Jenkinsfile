pipeline {
    agent {
        node {
            label 'aostp-agent'
        }
    }

    environment {
        // Customize these credentials and variables for your project
        SLACK_WEBHOOK_URL = credentials('slack-webhook') // Optional: Remove if not using Slack notifications
        DOCKER_HUB_CREDENTIALS = credentials('docker-hub-credentials')
        DOCKER_IMAGE_NAME = "${DOCKER_HUB_CREDENTIALS_USR}/aostp-api"
        DOCKER_TAG = "${env.BUILD_NUMBER}-${env.GIT_COMMIT?.take(7) ?: 'unknown'}"
        NODE_ENV = 'production'
        // Add your specific environment variables here, e.g., database URLs, secrets
        // DATABASE_URL_TEST = credentials('database-url-test')
        // DATABASE_URL_PROD = credentials('database-url-prod')
    }

    stages {
        stage('Checkout') {
            steps {
                echo '🔄 Checking out code from SCM...'
                checkout scm
                script {
                    env.GIT_COMMIT = sh(returnStdout: true, script: 'git rev-parse HEAD').trim()
                    env.GIT_BRANCH = sh(returnStdout: true, script: 'git rev-parse --abbrev-ref HEAD').trim()
                    env.GIT_AUTHOR = sh(returnStdout: true, script: 'git log -1 --pretty=format:"%an"').trim()
                    env.DOCKER_TAG = "${env.BUILD_NUMBER}-${env.GIT_COMMIT.take(7)}"
                    echo "Branch: ${env.GIT_BRANCH}, Commit: ${env.GIT_COMMIT.take(7)}, Author: ${env.GIT_AUTHOR}, Tag: ${env.DOCKER_TAG}"
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                echo '🐳 Building Docker image...'
                sh """
                    docker build --network=host --target production \\
                        --tag "${DOCKER_IMAGE_NAME}:${DOCKER_TAG}" \\
                        --tag "${DOCKER_IMAGE_NAME}:latest" \\
                        --build-arg NODE_ENV=production \\
                        .
                    docker images "${DOCKER_IMAGE_NAME}:${DOCKER_TAG}"
                """
            }
        }

        // Optional security scans - uncomment and configure if needed
        // stage('Security Scan - OWASP Dependency Check') { ... }
        // stage('Security Scan - Docker Image') { ... }

        stage('Test Docker Image') {
            steps {
                echo '🧪 Testing Docker image...'
                // Add credentials bindings here, e.g.:
                // withCredentials(bindings: [string(credentialsId: 'database-url-test', variable: 'DATABASE_URL'), ...]) {
                sh '''
                    # Cleanup any existing test containers first
                    docker stop aostp-api-test || true
                    docker rm aostp-api-test || true

                    # Assume .env.production and scripts exist; customize as needed
                    if [ -f .env.example ]; then
                        cp .env.example .env.test
                    fi

                    # Start the container for testing
                    docker run -d --name aostp-api-test --env-file .env.test -p 3003:3000 "${DOCKER_IMAGE_NAME}:${DOCKER_TAG}"

                    # Wait and health check
                    sleep 30
                    for i in {1..10}; do
                        if curl -f http://localhost:3003/health; then
                            echo "✅ Health check passed"
                            break
                        fi
                        echo "Retry $i/10..."
                        sleep 5
                    done

                    # Additional tests if scripts exist
                    if [ -f scripts/migrate.sh ]; then
                        docker exec aostp-api-test ./scripts/migrate.sh || echo "Migration script not found or failed"
                    fi

                    # Cleanup
                    docker stop aostp-api-test || true
                    docker rm aostp-api-test || true
                    rm -f .env.test
                '''
                // }
            }
        }

        stage('Push to Docker Hub') {
            when {
                anyOf {
                    branch 'main'
                    branch 'test'
                }
            }
            steps {
                echo '📦 Pushing Docker image...'
                sh '''
                    echo "${DOCKER_HUB_CREDENTIALS_PSW}" | docker login -u "${DOCKER_HUB_CREDENTIALS_USR}" --password-stdin
                    docker push "${DOCKER_IMAGE_NAME}:${DOCKER_TAG}"
                    docker push "${DOCKER_IMAGE_NAME}:latest"
                    docker logout
                '''
            }
        }

        stage('Deploy to Test Environment') {
            when {
                branch 'test'
            }
            steps {
                echo '🚀 Deploying to test environment...'
                // withCredentials(bindings: [...]) {
                sh '''
                    if [ -f .env.example ]; then
                        cp .env.example .env.test
                    fi

                    DOCKER_IMAGE_NAME="${DOCKER_IMAGE_NAME}" DOCKER_TAG="${DOCKER_TAG}" docker compose -f docker-compose.yml down || true
                    DOCKER_IMAGE_NAME="${DOCKER_IMAGE_NAME}" DOCKER_TAG="${DOCKER_TAG}" docker compose -f docker-compose.yml up -d

                    sleep 30
                    # Add migration/seeding if scripts exist
                    if [ -f scripts/migrate.sh ]; then
                        docker exec aostp-api-test ./scripts/migrate.sh
                    fi
                    rm -f .env.test
                '''
                // }
            }
        }

        stage('Deploy to Production Environment') {
            when {
                branch 'main'
            }
            steps {
                echo '🚀 Deploying to production environment...'
                // withCredentials(bindings: [...]) {
                sh '''
                    if [ -f .env.example ]; then
                        cp .env.example .env.production || cp .env.example .env.prod
                    fi

                    DOCKER_IMAGE_NAME="${DOCKER_IMAGE_NAME}" DOCKER_TAG="${DOCKER_TAG}" docker compose -f docker-compose.production.yml down || true
                    DOCKER_IMAGE_NAME="${DOCKER_IMAGE_NAME}" DOCKER_TAG="${DOCKER_TAG}" docker compose -f docker-compose.production.yml up -d

                    sleep 30
                    # Add migration/seeding if scripts exist
                    if [ -f scripts/migrate.sh ]; then
                        docker exec aostp-api-production ./scripts/migrate.sh
                    fi
                    rm -f .env.production .env.prod
                '''
                // }
            }
        }

        // Optional post-deploy tests - uncomment and customize
        // stage('Post-Deploy Tests - Test Environment') { ... }
        // stage('Post-Deploy Tests - Production Environment') { ... }
    }

    post {
        always {
            script {
                echo '🧹 Cleaning up...'
                sh '''
                    # Clean up old images
                    docker images "${DOCKER_IMAGE_NAME}" --format "{{.Tag}}" | grep -E "^[0-9]+" | sort -nr | tail -n +4 | xargs -r -I {} docker rmi "${DOCKER_IMAGE_NAME}:{}" || true
                    docker image prune -f || true
                '''
            }
        }
        success {
            script {
                echo '✅ Pipeline completed successfully!'
                if (env.SLACK_WEBHOOK_URL) {
                    sh '''
                        curl -X POST -H "Content-type: application/json" \\
                        --data "{\\"text\\":\\"✅ AOSTP API deployment successful\\\\nBranch: ${GIT_BRANCH}\\\\nCommit: ${GIT_COMMIT}\\\\nTag: ${DOCKER_TAG}\\"}" \\
                        "${SLACK_WEBHOOK_URL}" || true
                    '''
                }
            }
        }
        failure {
            script {
                echo '❌ Pipeline failed!'
                if (env.SLACK_WEBHOOK_URL) {
                    sh '''
                        curl -X POST -H "Content-type: application/json" \\
                        --data "{\\"text\\":\\"❌ AOSTP API deployment failed\\\\nBranch: ${GIT_BRANCH}\\\\nCommit: ${GIT_COMMIT}\\\\nBuild: ${BUILD_URL}\\"}" \\
                        "${SLACK_WEBHOOK_URL}" || true
                    '''
                }
            }
        }
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 30, unit: 'MINUTES')
    }
}
