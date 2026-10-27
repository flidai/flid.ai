package main

import (
	"errors"
	"fmt"
	"log"
	"mime"
	"net"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

var contentTypes = map[string]string{
	".css":         "text/css; charset=utf-8",
	".html":        "text/html; charset=utf-8",
	".ico":         "image/x-icon",
	".js":          "text/javascript; charset=utf-8",
	".jpeg":        "image/jpeg",
	".jpg":         "image/jpeg",
	".mjs":         "text/javascript; charset=utf-8",
	".mp4":         "video/mp4",
	".png":         "image/png",
	".svg":         "image/svg+xml",
	".txt":         "text/plain; charset=utf-8",
	".webmanifest": "application/manifest+json",
	".webp":        "image/webp",
	".xml":         "application/xml; charset=utf-8",
}

type staticHandler struct {
	root string
}

func main() {
	root := envOrDefault("SITE_ROOT", "dist")
	port := envOrDefault("PORT", "3000")

	handler, err := newStaticHandler(root)
	if err != nil {
		log.Fatal(err)
	}

	server := &http.Server{
		Addr:              net.JoinHostPort("127.0.0.1", port),
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("Flid static site: http://localhost:%s", port)
	if err := server.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}

func envOrDefault(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}

func newStaticHandler(root string) (http.Handler, error) {
	absoluteRoot, err := filepath.Abs(root)
	if err != nil {
		return nil, fmt.Errorf("resolve site root: %w", err)
	}

	info, err := os.Stat(absoluteRoot)
	if err != nil {
		return nil, fmt.Errorf("open site root: %w", err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("site root is not a directory: %s", absoluteRoot)
	}

	return staticHandler{root: absoluteRoot}, nil
}

func (handler staticHandler) ServeHTTP(response http.ResponseWriter, request *http.Request) {
	response.Header().Set("Cache-Control", "no-store")

	if request.Method != http.MethodGet && request.Method != http.MethodHead {
		response.Header().Set("Allow", "GET, HEAD")
		http.Error(response, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	requestPath := strings.ReplaceAll(request.URL.Path, "\\", "/")
	for _, segment := range strings.Split(requestPath, "/") {
		if segment == ".." {
			http.Error(response, "Forbidden", http.StatusForbidden)
			return
		}
	}

	cleanPath := strings.TrimPrefix(path.Clean("/"+requestPath), "/")
	target := filepath.Join(handler.root, filepath.FromSlash(cleanPath))
	target, info, err := resolveTarget(target)
	if err != nil {
		handler.serveNotFound(response, request)
		return
	}

	relative, err := filepath.Rel(handler.root, target)
	if err != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
		http.Error(response, "Forbidden", http.StatusForbidden)
		return
	}

	file, err := os.Open(target)
	if err != nil {
		handler.serveNotFound(response, request)
		return
	}
	defer file.Close()

	extension := strings.ToLower(filepath.Ext(target))
	contentType := contentTypes[extension]
	if contentType == "" {
		contentType = mime.TypeByExtension(extension)
	}
	if contentType != "" {
		response.Header().Set("Content-Type", contentType)
	}

	http.ServeContent(response, request, info.Name(), info.ModTime(), file)
}

// serveNotFound mirrors GitHub Pages: when the site ships a 404.html, every
// unknown path answers 404 with that page. Without one it falls back to a
// plain-text 404.
func (handler staticHandler) serveNotFound(response http.ResponseWriter, request *http.Request) {
	page, err := os.ReadFile(filepath.Join(handler.root, "404.html"))
	if err != nil {
		http.Error(response, "Not found", http.StatusNotFound)
		return
	}

	response.Header().Set("Content-Type", contentTypes[".html"])
	response.Header().Set("Content-Length", strconv.Itoa(len(page)))
	response.WriteHeader(http.StatusNotFound)
	if request.Method != http.MethodHead {
		_, _ = response.Write(page)
	}
}

func resolveTarget(target string) (string, os.FileInfo, error) {
	info, err := os.Stat(target)
	if err == nil && info.IsDir() {
		target = filepath.Join(target, "index.html")
		info, err = os.Stat(target)
	} else if errors.Is(err, os.ErrNotExist) && filepath.Ext(target) == "" {
		target = filepath.Join(target, "index.html")
		info, err = os.Stat(target)
	}

	if err != nil {
		return "", nil, err
	}
	if !info.Mode().IsRegular() {
		return "", nil, errors.New("target is not a regular file")
	}

	return target, info, nil
}
