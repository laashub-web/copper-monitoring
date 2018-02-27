package org.copperengine.monitoring.jmxwebproxy;


import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.servlet.*;
import javax.servlet.http.*;
import java.io.IOException;

public class UserServlet extends HttpServlet {
    private static final Logger log = LoggerFactory.getLogger(UserServlet.class);
    private static String ENGINE_HOST = System.getenv("ENGINE_HOST");
    private static String ENGINE_PORT = System.getenv("ENGINE_PORT");

    static {
        if (ENGINE_HOST == null || ENGINE_HOST.trim().length() == 0) {
            ENGINE_HOST = "localhost";
        }

        if (ENGINE_PORT == null || ENGINE_PORT.trim().length() == 0) {
            ENGINE_PORT = "1099";
        }
    }

    // Return user settings
    public void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json");
        response.setCharacterEncoding("utf-8");

        StringBuilder jsonBuilder = new StringBuilder();
        jsonBuilder.append("{ ");
        jsonBuilder.append("\"host\": ");
        jsonBuilder.append("\"" + ENGINE_HOST + "\"");
        jsonBuilder.append(", ");
        jsonBuilder.append("\"port\": ");
        jsonBuilder.append("\"" + ENGINE_PORT +"\" ");
        jsonBuilder.append(" }");

        response.getWriter().println(jsonBuilder.toString());
    }
}