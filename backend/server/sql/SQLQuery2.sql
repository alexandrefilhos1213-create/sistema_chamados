USE chamados_db;
GO

IF OBJECT_ID('dbo.messages', 'U') IS NOT NULL DROP TABLE dbo.messages;
IF OBJECT_ID('dbo.tickets',  'U') IS NOT NULL DROP TABLE dbo.tickets;
IF OBJECT_ID('dbo.users',    'U') IS NOT NULL DROP TABLE dbo.users;
GO
CREATE TABLE dbo.users (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    nome        NVARCHAR(100) NOT NULL,
    email       NVARCHAR(120) NOT NULL UNIQUE,
    senha       NVARCHAR(100) NOT NULL,
    role        NVARCHAR(20) NOT NULL DEFAULT 'user',
    created_at  DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

CREATE TABLE dbo.tickets (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    user_id       INT NOT NULL,
    nome_usuario  NVARCHAR(120) NOT NULL,
    gravidade     NVARCHAR(20) NOT NULL CHECK (gravidade IN ('Baixo','Médio','Medio','Alto')),
    descricao     NVARCHAR(1000) NOT NULL,
    status        NVARCHAR(20) NOT NULL DEFAULT 'aberto',
    created_at    DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    closed_at     DATETIME2 NULL,
    CONSTRAINT FK_tickets_users FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE
);
GO

CREATE TABLE dbo.messages (
    id           INT IDENTITY(1,1) PRIMARY KEY,
    ticket_id    INT NOT NULL,
    sender_id    INT NOT NULL,
    sender_role  NVARCHAR(20) NOT NULL CHECK (sender_role IN ('user','tech')),
    content      NVARCHAR(1000) NOT NULL,
    created_at   DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_messages_tickets FOREIGN KEY (ticket_id) REFERENCES dbo.tickets(id) ON DELETE CASCADE,
    CONSTRAINT FK_messages_users   FOREIGN KEY (sender_id) REFERENCES dbo.users(id) ON DELETE NO ACTION
);
GO
