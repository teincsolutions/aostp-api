pipeline {
    agent {
        node {
            label 'aostp-agent'
        }
    }

    environment {
        // Customize these credentials and variables for your project
        SLACK_WEBHOOK_URL = credentials('aostp-slack-webhook')
        DOCKER_IMAGE_NAME = 'teincsolutions/aostp-api'
        DOCKER_TAG = "${env.BUILD_NUMBER}-${env.GIT_COMMIT?.take(7) ?: 'unknown'}"
        NODE_ENV = 'production'
        CORS_ORIGIN = 'https://aostp.akomapacargo.com'
        CDN_DOMAIN = 'cdn.akomapacargo.com'
        JWT_EXPIRATION = '15m'
        JWT_REFRESH_EXPIRATION = '7d'
        SMS_PROVIDER = 'sms-online-gh'

        // SMS Online GH Provider
        SMS_ONLINE_GH_API_KEY = credentials('sms-online-gh-api-key')
        SMS_ONLINE_GH_SENDER_ID = 'Willfind8'

        EMAIL_PROVIDER = 'nodemailer'
        SMTP_SECURE = true
        EMAIL_FROM = 'support@teincsolutions.com'
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
                withDockerRegistry([ credentialsId: 'docker-hub-credentials', url: '' ]) {
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
        }

        stage('Test Docker Image') {
            steps {
                echo '🧪 Testing Docker image...'
                // Add credentials bindings
                withCredentials(bindings: [string(credentialsId: 'database-url-test', variable: 'DATABASE_URL'),
                                            string(credentialsId: 's3-bucket-url-test', variable: 'S3_BUCKET_URL'),
                                            string(credentialsId: 's3-region-test', variable: 'AWS_REGION'),
                                            string(credentialsId: 's3-access-key-id-test', variable: 'S3_ACCESS_KEY_ID'),
                                            string(credentialsId: 's3-secret-access-key-test', variable: 'S3_SECRET_ACCESS_KEY'),
                                            string(credentialsId: 'jwt-secret-test', variable: 'JWT_SECRET'),
                                            string(credentialsId: 'jwt-refresh-secret-test', variable: 'JWT_REFRESH_SECRET'),
                                            string(credentialsId: 'encryption-key-test', variable: 'ENCRYPTION_KEY')]) {
                    sh '''
                    # Cleanup any existing test containers first
                    docker stop aostp-api-test || true
                    docker rm aostp-api-test || true
                    # Prepare .env.test from .env.example if it exists
                    if [ -f .env.example ]; then
                        envsubst < .env.example > .env.test
                    fi

                    # Start the container for testing
                    docker run -d --name aostp-api-test --network aostp-internal-net --env-file .env.test "${DOCKER_IMAGE_NAME}:${DOCKER_TAG}"

                    # Wait and health check
                    sleep 10

                    if curl -I http://aostp-api-test:3000; then
                        echo "✅ Health check passed"
                    else
                        echo "❌ Health check failed"
                        exit 1
                    fi

                    # Cleanup
                    docker stop aostp-api-test || true
                    docker rm aostp-api-test || true
                    rm -f .env.test
                '''
                                            }
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
                withDockerRegistry([ credentialsId: 'docker-hub-credentials', url: '' ]) {
                    echo '📦 Pushing Docker image...'
                    sh '''
                        docker push "${DOCKER_IMAGE_NAME}:${DOCKER_TAG}"
                        docker push "${DOCKER_IMAGE_NAME}:latest"
                    '''
                }
            }
        }

        stage('Configure S3 Bucket Policy') {
            when {
                anyOf {
                    branch 'main'
                    branch 'test'
                }
            }
            steps {
                withCredentials(bindings: [string(credentialsId: 's3-bucket-url-prod', variable: 'AWS_S3_ENDPOINT'),
                                            string(credentialsId: 's3-region-prod', variable: 'AWS_REGION'),
                                            string(credentialsId: 's3-access-key-id-prod', variable: 'AWS_ACCESS_KEY_ID'),
                                            string(credentialsId: 's3-secret-access-key-prod', variable: 'AWS_SECRET_ACCESS_KEY'),
                                            string(credentialsId: 's3-packages-bucket-prod', variable: 'AWS_PACKAGES_BUCKET_NAME'),
                                              string(credentialsId: 's3-users-bucket-prod', variable: 'AWS_USERS_BUCKET_NAME'),
                                                string(credentialsId: 's3-logs-bucket-prod', variable: 'AWS_LOGS_BUCKET_NAME')]) {
                    sh '''
                        # Setuping s3 buckets policies
                        echo "🪣 Initializing s3 buckets policies for production environment..."
                        chmod +x ./scripts/setup-s3-policy.sh
                        ./scripts/setup-s3-policy.sh

                    '''
                                                }
            }
        }

        stage('Deploy to Production Environment') {
            when {
                branch 'main'
            }
            steps {
                echo '🚀 Deploying to production environment...'
                withCredentials(bindings: [string(credentialsId: 'database-url-prod', variable: 'DATABASE_URL'),
                                            string(credentialsId: 's3-bucket-url-prod', variable: 'AWS_S3_ENDPOINT'),
                                            string(credentialsId: 's3-region-prod', variable: 'AWS_REGION'),
                                            string(credentialsId: 's3-access-key-id-prod', variable: 'AWS_ACCESS_KEY_ID'),
                                            string(credentialsId: 's3-secret-access-key-prod', variable: 'AWS_SECRET_ACCESS_KEY'),
                                            string(credentialsId: 's3-packages-bucket-prod', variable: 'AWS_PACKAGES_BUCKET_NAME'),
                                              string(credentialsId: 's3-users-bucket-prod', variable: 'AWS_USERS_BUCKET_NAME'),
                                                string(credentialsId: 's3-logs-bucket-prod', variable: 'AWS_LOGS_BUCKET_NAME'),
                                            string(credentialsId: 'jwt-secret-prod', variable: 'JWT_SECRET'),
                                            string(credentialsId: 'jwt-refresh-secret-prod', variable: 'JWT_REFRESH_SECRET'),
                                            string(credentialsId: 'encryption-key-prod', variable: 'ENCRYPTION_KEY'),
                                            string(credentialsId: 'hubtel-api-id-prod', variable: 'HUBTEL_API_ID'),
                                            string(credentialsId: 'hubtel-api-key-prod', variable: 'HUBTEL_API_KEY'),
                                            string(credentialsId: 'sms-online-gh-api-key', variable: 'SMS_ONLINE_GH_API_KEY'),
                                            string(credentialsId: 'sms-online-gh-sender-id', variable: 'SMS_ONLINE_GH_SENDER_ID'),
                                            string(credentialsId: 'smtp-user', variable: 'SMTP_USER'),
                                            string(credentialsId: 'smtp-pass', variable: 'SMTP_PASS')]) {
                    sh '''
                        if [ -f .env.example ]; then
                              envsubst < .env.example > .env.production
                        fi

                    docker compose -f docker-compose.production.yml down || true
                    docker compose -f docker-compose.production.yml up -d

                    sleep 10
                    # Add migration/seeding if scripts exist
                    if [ -f scripts/migrate.sh ]; then
                        docker exec aostp-api-production ./scripts/migrate.sh
                    fi

                     # Wait and health check
                    for i in {1..10}; do
                        if curl -f http://localhost:3000/api/v1/health; then
                            echo "✅ Health check passed"
                            break
                        fi
                        echo "Retry $i/10..."
                        sleep 5
                    done
                    rm -f .env.production .env.production
                '''
                                            }
            }
        }
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
