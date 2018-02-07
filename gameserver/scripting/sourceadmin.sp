#include <sourcemod>
#include <ripext>
#include <sockets>

#pragma newdecls required
#pragma semicolon 1

ArrayList g_aCommandQueue;
ArrayList g_aReasons;

char g_sReasonsFile[256];
char g_sServerIP[16];

//ConVar g_cHostName;
ConVar g_cSocketAddress;
ConVar g_cSocketPort;

enum SocketStatus
{
	eSocket_Closed,
	eSocket_Disconnected,
	eSocket_Connecting,
	eSocket_Connected
}

Handle g_hSocketHandle;

SocketStatus g_sSocketStatus = eSocket_Closed;

public Plugin myinfo =
{
	name = "SourceAdmin",
	author = "Techno <i.will@spamthe.world>",
	description = "SourceAdmin - The Simple CallAdmin Software",
	version = "1.0.0",
	url = "https://github.com/technoblazed/sourceadmin"
};

public void OnPluginStart()
{
	LoadTranslations("sourceadmin.phrases.txt");

	//g_cHostName = FindConVar("hostname");

	g_cSocketAddress = CreateConVar("sm_sourceadmin_address", "localhost", "Address of the SourceAdmin server");
	g_cSocketPort = CreateConVar("sm_sourceadmin_port", "19857", "Port of the SourceAdmin server", _, true, 1.0);

	AutoExecConfig(true, "sourceadmin");

	RegConsoleCmd("call", Command_Report, "Open up the report player menu");
	RegConsoleCmd("report", Command_Report, "Open up the report player menu");

	AddCommandListener(CommandListener_Say, "say");
	AddCommandListener(CommandListener_SayTeam, "say_team");

	g_hSocketHandle = SocketCreate(SOCKET_TCP, OnSocketError);
	g_sSocketStatus = eSocket_Disconnected;

	g_aCommandQueue = new ArrayList(ByteCountToCells(4096));
	g_aReasons = new ArrayList(ByteCountToCells(128));

	BuildPath(Path_SM, g_sReasonsFile, sizeof(g_sReasonsFile), "configs/sourceadmin_reasons.cfg");

	if (!FileExists(g_sReasonsFile, false, "GAME"))
    {
        GenerateReasonFile();
    }

	ParseReasonsFile();
}

public void OnConfigsExecuted()
{
	if (g_sSocketStatus == eSocket_Disconnected)
	{
		ConnectToSocket();
	}
}

/**
 *	Socket Connection Mannagement
 */

public void ConnectToSocket()
{
	char sHost[16];

	g_cSocketAddress.GetString(sHost, sizeof(sHost));

	g_sSocketStatus = eSocket_Connecting;

	SocketSetOption(g_hSocketHandle, SocketReceiveTimeout, 5000);
	SocketSetOption(g_hSocketHandle, SocketSendTimeout, 5000);

	SocketConnect(g_hSocketHandle, OnSocketConnected, OnSocketReceive, OnSocketDisconnect, sHost, g_cSocketPort.IntValue);
}

public int OnSocketConnected(Handle socket, any arg)
{
	g_sSocketStatus = eSocket_Connected;

	ProcessSocketOutbound();
}

public int OnSocketDisconnect(Handle socket, any arg)
{
	g_sSocketStatus = eSocket_Disconnected;

	if (g_aCommandQueue.Length > 0)
	{
		CreateTimer(3.0, Timer_ProcessData);
	}
}

public Action Timer_ProcessData(Handle timer)
{
	ProcessSocketOutbound();
}

public int OnSocketError(Handle socket, const int errorType, const int errorNum, any arg)
{
	delete g_hSocketHandle;

	g_sSocketStatus = eSocket_Closed;

	g_aCommandQueue.Clear();

	LogError("Socket error %d, %d", errorType, errorNum);
}

/**
 *	Socket Processing - Inbound
 */

public int OnSocketReceive(Handle socket, const char[] receiveData, const int dataSize, any arg)
{
	// Socket Receives data
}

/**
 *	Socket Processing - Outbound
 */

public void ProcessSocketOutbound()
{
	if (g_sSocketStatus == eSocket_Closed)
	{
		g_hSocketHandle = SocketCreate(SOCKET_TCP, OnSocketError);
		g_sSocketStatus = eSocket_Disconnected;
	}

	if (g_sSocketStatus == eSocket_Disconnected)
	{
		ConnectToSocket();
	}
	else if (g_sSocketStatus == eSocket_Connected)
	{
		char sBuffer[4096];

		while (g_aCommandQueue.Length > 0)
		{
			int item = g_aCommandQueue.GetString(0, sBuffer, sizeof(sBuffer));

			SocketSend(g_hSocketHandle, sBuffer, item);

			g_aCommandQueue.Erase(0);
		}
	}
}

/**
 *	Command Processing
 */

public Action Command_Report(int client, int args)
{
	return Plugin_Handled;
}

/**
 *	Chat Processing
 */

public Action CommandListener_Say(int client, const char[] command, int argc)
{
	char sMessage[192];

	GetCmdArgString(sMessage, sizeof(sMessage));

	OnChatMessage(client, sMessage, 1);

	return Plugin_Continue;
}

public Action CommandListener_SayTeam(int client, const char[] command, int argc)
{
	char sMessage[192];

	GetCmdArgString(sMessage, sizeof(sMessage));

	OnChatMessage(client, sMessage, 2);

	return Plugin_Continue;
}

public void OnChatMessage(int client, char[] sMessage, int type)
{
	if (!IsValidClient(client))
	{
		return;
	}

	StripQuotes(sMessage);

	if (strlen(sMessage) < 1)
	{
		return;
	}

	char sName[64];
	char sSteamID[20];

	GetClientName(client, sName, sizeof(sName));
	GetClientAuthId(client, AuthId_SteamID64, sSteamID, sizeof(sSteamID));

	JSONObject jChatObject = new JSONObject();

	if (type == 1)
	{
		jChatObject.SetString("type", "chat");
	}
	else if (type == 2)
	{
		jChatObject.SetString("type", "chat_team");
	}

	jChatObject.SetString("message", sMessage);
	jChatObject.SetString("name", sName);
	jChatObject.SetString("steam", sSteamID);

	char sRequest[512];

	jChatObject.ToString(sRequest, sizeof(sRequest));
	StrCat(sRequest, sizeof(sRequest), "\n");

	g_aCommandQueue.PushString(sRequest);

	delete jChatObject;
}

/**
 *	Server IP Processing
 */

public void BuildIP()
{
	char sPort[8];
	char sPublicAddress[128];

	FindConVar("hostport").GetString(sPort, sizeof(sPort));
	FindConVar("net_public_adr").GetString(sPublicAddress, sizeof(sPublicAddress));

	if (!(strlen(sPublicAddress)))
	{
		FindConVar("ip").GetString(sPublicAddress, sizeof(sPublicAddress));

		int index = FindCharInString(sPublicAddress, ':');

		if (index == -1)
		{
			sPublicAddress[0] = '\0';
		}
		else
		{
			sPublicAddress[index] = '\0';
		}
	}

	if (strlen(sPublicAddress) == 0)
	{
		int iIpVal = FindConVar("hostip").IntValue;
		int iIpVals[4];

		iIpVals[0] = (iIpVal >> 24) & 0x000000FF;
		iIpVals[1] = (iIpVal >> 16) & 0x000000FF;
		iIpVals[2] = (iIpVal >> 8) & 0x000000FF;
		iIpVals[3] = iIpVal & 0x000000FF;

		FormatEx(g_sServerIP, sizeof(g_sServerIP), "%d.%d.%d.%d:%s", iIpVals[0], iIpVals[1], iIpVals[2], iIpVals[3], sPort);
	}
	else
	{
		FormatEx(g_sServerIP, sizeof(g_sServerIP), "%s:%s", sPublicAddress, sPort);
	}
}

/**
 *	Reason File Management
 */

public void GenerateReasonFile()
{
	File file = OpenFile(g_sReasonsFile, "w", false, "GAME");

	if (!file)
	{
		SetFailState("Failed to open config file 'config/sourceadmin_reasons.cfg' for writing!");
	}

	file.WriteLine("// List of reasons seperated by a new line, max %d in length", 128);
	file.WriteLine("Advertising");
	file.WriteLine("Chat/Mic Spam");
	file.WriteLine("Disrespect");
	file.WriteLine("Hacking");
	file.WriteLine("Harrassment");
	file.WriteLine("Hate Speech/Racism");
	file.WriteLine("Impersonation");
	file.WriteLine("Inappropriate Name");

	file.Close();
}

public void ParseReasonsFile()
{
	File file = OpenFile(g_sReasonsFile, "w", false, "GAME");

	if (!file)
	{
		SetFailState("Failed to open config file 'config/sourceadmin_reasons.cfg' for reading!");
	}

	char sBuffer[128];

	while (!file.EndOfFile() && file.ReadLine(sBuffer, sizeof(sBuffer)))
	{
		if (!(sBuffer[0] == '/' || IsCharSpace(sBuffer[0])))
		{
			ReplaceString(sBuffer, sizeof(sBuffer), "\n", "", true);
			ReplaceString(sBuffer, sizeof(sBuffer), "\r", "", true);
			ReplaceString(sBuffer, sizeof(sBuffer), "	", "", true);

			int len = strlen(sBuffer);

			if (!(len < 3 || len > 128))
			{
				if (g_aReasons.FindString(sBuffer) == -1)
				{
					g_aReasons.PushString(sBuffer);
				}
			}
		}
	}

	file.Close();
}

/**
 *	Stock Functions
 */

stock bool IsValidClient(int client)
{
	return client > 0 && client <= MaxClients && IsClientConnected(client) && IsClientInGame(client);
}
