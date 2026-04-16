package com.kwiklist.controller

import com.kwiklist.model.ShoppingItem
import com.kwiklist.model.ShoppingList
import com.kwiklist.repository.ShoppingItemRepository
import com.kwiklist.repository.ShoppingListRepository
import org.springframework.data.repository.findByIdOrNull
import org.springframework.http.HttpStatus
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException

@RestController
@RequestMapping("/api/lists")
@CrossOrigin(origins = ["*"])
class ShoppingListController(
    private val listRepository: ShoppingListRepository,
    private val itemRepository: ShoppingItemRepository,
    private val messagingTemplate: SimpMessagingTemplate
) {
    @GetMapping
    fun getAllLists(@RequestParam(required = false) userId: String?): List<ShoppingList> {
        return if (userId != null) {
            listRepository.findByMembersContaining(userId)
        } else {
            emptyList()
        }
    }

    @GetMapping("/code/{code}")
    fun getListByCode(@PathVariable code: String): ShoppingList {
        return listRepository.findByIdStartingWith(code).firstOrNull()
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Lista no encontrada")
    }

    @PostMapping
    fun createList(@RequestBody list: ShoppingList): ShoppingList {
        val saved = listRepository.save(list)
        messagingTemplate.convertAndSend("/topic/lists", saved)
        return saved
    }

    @GetMapping("/{id}")
    fun getList(@PathVariable id: String): ShoppingList {
        return listRepository.findByIdOrNull(id)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Lista no encontrada")
    }

    @PutMapping("/{id}")
    fun updateList(@PathVariable id: String, @RequestBody payload: Map<String, String>): ShoppingList {
        val list = listRepository.findByIdOrNull(id)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Lista no encontrada")
        payload["name"]?.let { list.name = it }
        val saved = listRepository.save(list)
        messagingTemplate.convertAndSend("/topic/lists/$id/update", saved)
        return saved
    }

    @DeleteMapping("/{id}")
    fun deleteList(@PathVariable id: String) {
        val list = listRepository.findByIdOrNull(id)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Lista no encontrada")
        listRepository.delete(list)
    }

    @PostMapping("/{id}/join")
    fun joinList(@PathVariable id: String, @RequestBody payload: Map<String, String>): ShoppingList {
        val list = listRepository.findByIdOrNull(id)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Lista no encontrada")
        val memberId = payload["userId"]
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Se requiere userId")
        if (!list.members.contains(memberId)) {
            list.members.add(memberId)
            val saved = listRepository.save(list)
            messagingTemplate.convertAndSend("/topic/lists", saved)
            messagingTemplate.convertAndSend("/topic/lists/$id/update", saved)
            return saved
        }
        return list
    }

    @PostMapping("/{id}/leave")
    fun leaveList(@PathVariable id: String, @RequestBody payload: Map<String, String>): ShoppingList {
        val list = listRepository.findByIdOrNull(id)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Lista no encontrada")
        val memberId = payload["userId"]
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "Se requiere userId")
        list.members.remove(memberId)
        val saved = listRepository.save(list)
        messagingTemplate.convertAndSend("/topic/lists/$id/update", saved)
        return saved
    }

    @PostMapping("/{id}/items")
    fun addItem(@PathVariable id: String, @RequestBody item: ShoppingItem): ShoppingItem {
        val list = listRepository.findByIdOrNull(id)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Lista no encontrada")
        item.shoppingList = list
        val saved = itemRepository.save(item)
        messagingTemplate.convertAndSend("/topic/lists/$id", saved)
        return saved
    }

    @PutMapping("/items/{itemId}")
    fun toggleItem(@PathVariable itemId: String, @RequestBody itemUpdate: ShoppingItem): ShoppingItem {
        val item = itemRepository.findByIdOrNull(itemId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado")
        item.isCompleted = itemUpdate.isCompleted
        val saved = itemRepository.save(item)
        messagingTemplate.convertAndSend("/topic/lists/${item.shoppingList?.id}", saved)
        return saved
    }

    @DeleteMapping("/items/{itemId}")
    fun deleteItem(@PathVariable itemId: String) {
        val item = itemRepository.findByIdOrNull(itemId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "Producto no encontrado")
        val listId = item.shoppingList?.id
        itemRepository.delete(item)
        messagingTemplate.convertAndSend("/topic/lists/$listId/delete", itemId)
    }
}
