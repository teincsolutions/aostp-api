pipeline {
    agent {
        node {
            label 'aostp-agent'
        }
    }

    environment {
        // Customize these credentials and variables for your project
        SLACK_WEBHOOK_URL = credentials('slack-webhook')
        DOCKER_IMAGE_NAME = "teincsolutions/aostp-api"
        DOCKER_TAG = "${env.BUILD_NUMBER}-${env.GIT_COMMIT?.take(7) ?: 'unknown'}"
        NODE_ENV = 'production'
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
                withCredentials(bindings: [string(credentialsId: 'database-url-test', variable: 'DATABASE_URL')]) {
                    sh '''
                    # Cleanup any existing test containers first
                    docker stop aostp-api-test || true
                    docker rm aostp-api-test || true
                    # Prepare .env.test from .env.example if it exists
                    if [ -f .env.example ]; then
                          envsubst < .env.example > .env.test
                    fi

                    # Start the container for testing
                    docker run -d --name aostp-api-test --env-file .env.test "${DOCKER_IMAGE_NAME}:${DOCKER_TAG}"

                    # Wait and health check
                    sleep 30
                    docker exec aostp-api-test sh -c '
                            if curl -f http://localhost:3000/api/v1/health; then
                                echo "✅ Health check passed"
                                exit 0
                            fi
                            echo "❌ Health check failed"
                            exit 1
                    '
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

        stage('Deploy to Test Environment') {
            when {
                branch 'test'
            }
            steps {
                echo '🚀 Deploying to test environment...'
                withCredentials(bindings: [string(credentialsId: 'database-url-test', variable: 'DATABASE_URL'),
                                            string(credentialsId: 's3-bucket-url-test', variable: 'S3_BUCKET_URL'),
                                            string(credentialsId: 's3-access-key-id-test', variable: 'S3_ACCESS_KEY_ID'),
                                            string(credentialsId: 's3-secret-access-key-test', variable: 'S3_SECRET_ACCESS_KEY')]) {
                    sh '''
                        if [ -f .env.example ]; then
                            cp .env.example .env.test
                        fi

                    docker compose -f docker-compose.test.yml down || true
                    docker compose -f docker-compose.test.yml up -d

                    sleep 30
                    # Add migration/seeding if scripts exist
                    if [ -f scripts/migrate.sh ]; then
                        docker exec aostp-api-test ./scripts/migrate.sh
                    fi

                     # Wait and health check
                    sleep 30
                    for i in {1..10}; do
                        if curl -f http://localhost:3001/api/v1/health; then
                            echo "✅ Health check passed"
                            break
                        fi
                        echo "Retry $i/10..."
                        sleep 5
                    done

                    rm -f .env.test
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
                                            string(credentialsId: 's3-bucket-url-prod', variable: 'S3_BUCKET_URL'),
                                            string(credentialsId: 's3-access-key-id-prod', variable: 'S3_ACCESS_KEY_ID'),
                                            string(credentialsId: 's3-secret-access-key-prod', variable: 'S3_SECRET_ACCESS_KEY')]) {
                    sh '''
                        if [ -f .env.example ]; then
                              envsubst < .env.example > .env.production
                        fi

                    docker compose -f docker-compose.production.yml down || true
                    docker compose -f docker-compose.production.yml up -d

                    sleep 30
                    # Add migration/seeding if scripts exist
                    if [ -f scripts/migrate.sh ]; then
                        docker exec aostp-api-production ./scripts/migrate.sh
                    fi

                     # Wait and health check
                    sleep 30
                    for i in {1..10}; do
                        if curl -f http://localhost:3000/api/v1/health; then
                            echo "✅ Health check passed"
                            break
                        fi
                        echo "Retry $i/10..."
                        sleep 5
                    done
                    rm -f .env.production .env.prod
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
